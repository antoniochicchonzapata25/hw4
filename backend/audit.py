"""Append-only audit trail of agent-loop activity: output/audit_trail.json (Problem 12).

Every chat run is turned into entries straight from PydanticAI's own message history
(the real tool calls, tool results and model stop reasons), so nothing is hand-written:

  - one entry per tool call:  time, tool, args (short), result (short), stop_reason
  - one "final_answer" entry: the model's last step (reply length + card ids, never the text)
  - one "agent_run" entry if the run fails (error type only)

Safety / privacy
  - Only tool arguments (product ids, search words, sizes) and short result summaries
    are stored. No message text, names, emails, passwords, hashes, cookies or keys.
  - Every string is truncated and passed through a redaction filter for secret-like values.
  - The shopper is recorded only as "guest" or "logged_in" (no user id).

Append-only
  - The file is a JSON array that is only ever extended. On each write the existing
    array is read, new entries are added at the end, and the result is written to a
    temp file that atomically replaces the original (os.replace), all under a lock.
    A crash mid-write therefore can't leave half-written JSON, and existing entries are
    never removed or rewritten. Startup never touches the file.
  - If the file exists but isn't a valid JSON array (e.g. edited by hand), it is moved
    aside to audit_trail.corrupt-<timestamp>.json, never deleted, and a new array starts.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic_ai.messages import ModelMessage, ModelResponse, RetryPromptPart, ToolCallPart, ToolReturnPart

AUDIT_PATH = Path(__file__).resolve().parent.parent / "output" / "audit_trail.json"
MAX_ARGS_CHARS = 200
MAX_RESULT_CHARS = 240
_LOCK = threading.Lock()

# Secret-looking values are replaced even if they somehow reach a tool argument/result.
_SECRET_PATTERNS = [
    re.compile(r"pbkdf2_sha256\$[^\s\"',]+"),           # password hashes
    re.compile(r"\bsk-[A-Za-z0-9_\-]{8,}"),              # API-key style tokens
    re.compile(r"cc_session=[^;\s\"']+"),                # session cookie
    re.compile(r"(?i)(password|passwd|api[_-]?key|secret|token)\s*[:=]\s*[^\s,\"']+"),
]
_SECRET_ENV_VARS = ("PORTKEY_API_KEY", "MANAGER_API_KEY", "SESSION_SECRET")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _iso(ts: datetime | None) -> str:
    if ts is None:
        return _now()
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _redact(text: str) -> str:
    for name in _SECRET_ENV_VARS:
        value = os.getenv(name)
        if value and len(value) >= 6:
            text = text.replace(value, "[redacted]")
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub("[redacted]", text)
    return text


def _short(text: str, limit: int) -> str:
    text = _redact(" ".join(str(text).split()))
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _ids(items: list[Any], attr: str = "product_id", show: int = 3) -> str:
    ids = [getattr(i, attr) for i in items]
    extra = f" (+{len(ids) - show})" if len(ids) > show else ""
    return ", ".join(ids[:show]) + extra


def summarize_result(content: Any) -> str:
    """Short, human-readable summary of a tool result (never a raw object dump)."""
    kind = type(content).__name__
    try:
        if kind == "ProductMatches":
            if not content.matches:
                return f"0 matches for '{content.query}'"
            return f"{content.total_matches} matches; returned {len(content.matches)}: {_ids(content.matches)}"
        if kind == "ProductInfo":
            return f"{content.product_id}: {content.name}, ${content.price_usd:.2f}, colors {content.colors_in_design}"
        if kind == "ProductPrice":
            return f"{content.product_id}: ${content.price_usd:.2f}"
        if kind == "ProductStock":
            base = f"{content.product_id}: total {content.total_quantity}; out of stock {content.out_of_stock_sizes or 'none'}"
            if content.requested_size:
                return f"{base}; {content.requested_size}={content.requested_size_quantity} " + (
                    "(in stock)" if content.requested_size_in_stock else "(OUT OF STOCK)"
                )
            return base
        if kind == "Alternatives":
            if not content.alternatives:
                return f"0 in-stock alternatives for {content.for_product_id} size {content.size or 'any'}"
            return f"{len(content.alternatives)} alternatives for {content.for_product_id} size {content.size or 'any'}: {_ids(content.alternatives)}"
        if kind == "LookupProblem":
            return f"not found: {content.problem}"
    except Exception:  # never let auditing break a chat
        pass
    if content is None or content == "":
        return "(no result)"
    return f"{kind}: {content}" if not isinstance(content, str) else content


def entries_from_run(
    run_id: str,
    messages: list[ModelMessage],
    *,
    shopper: str,
    page_product_id: str | None,
    model: str,
    reply_chars: int,
    card_ids: list[str],
    usage: dict[str, Any],
) -> list[dict]:
    """Build audit entries from one successful run's new messages (in loop order)."""
    results: dict[str, tuple[str, str]] = {}  # tool_call_id -> (summary, time)
    for msg in messages:
        for part in getattr(msg, "parts", []):
            if isinstance(part, ToolReturnPart):
                results[part.tool_call_id] = (summarize_result(part.content), _iso(part.timestamp))
            elif isinstance(part, RetryPromptPart) and part.tool_call_id:
                results[part.tool_call_id] = (f"retry requested: {part.content}", _iso(part.timestamp))

    base = {"run_id": run_id, "shopper": shopper, "page_product_id": page_product_id, "model": model}
    entries: list[dict] = []
    step = 0
    responses = [m for m in messages if isinstance(m, ModelResponse)]
    for i, resp in enumerate(responses):
        step += 1
        calls = [p for p in resp.parts if isinstance(p, ToolCallPart)]
        # Why this loop step ended: it called tools ("tool_call"), or the model finished
        # (provider finish reason: "stop", "length", "content_filter", ...). The Responses API
        # reports "stop" even for tool-calling steps, so tool calls are detected from the parts.
        stop = "tool_call" if calls else (resp.finish_reason or "stop")
        for call in calls:
            summary, when = results.get(call.tool_call_id, ("(no result recorded)", _iso(resp.timestamp)))
            entries.append({
                "time": when,
                **base,
                "step": step,
                "tool": call.tool_name,
                "args": _short(call.args_as_json_str(), MAX_ARGS_CHARS),
                "result": _short(summary, MAX_RESULT_CHARS),
                "stop_reason": stop,
            })
        if i == len(responses) - 1 and not calls:
            entries.append({
                "time": _iso(resp.timestamp),
                **base,
                "step": step,
                "tool": "final_answer",
                "args": "-",
                "result": _short(f"reply {reply_chars} chars; cards: {card_ids or 'none'}", MAX_RESULT_CHARS),
                "stop_reason": stop,
                "usage": usage,
            })
    return entries


def error_entry(run_id: str, *, shopper: str, page_product_id: str | None, model: str, error: BaseException) -> dict:
    kind = type(error).__name__
    if kind == "UsageLimitExceeded":
        stop = "usage_limit_exceeded"
    elif "content_filter" in str(getattr(error, "body", "") or "") or "content_filter" in str(error):
        stop = "content_filter"  # the model provider refused the prompt (e.g. jailbreak attempt)
    else:
        stop = f"error:{kind}"
    return {
        "time": _now(),
        "run_id": run_id,
        "shopper": shopper,
        "page_product_id": page_product_id,
        "model": model,
        "step": 0,
        "tool": "agent_run",
        "args": "-",
        "result": f"run failed ({kind})",  # type only: exception text may contain internals
        "stop_reason": stop,
    }


def new_run_id() -> str:
    return uuid.uuid4().hex[:12]


def append_entries(entries: list[dict]) -> None:
    """Append entries to output/audit_trail.json (create if missing, never overwrite old entries)."""
    if not entries:
        return
    with _LOCK:
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        existing: list = []
        if AUDIT_PATH.exists():
            try:
                loaded = json.loads(AUDIT_PATH.read_text(encoding="utf-8") or "[]")
                if not isinstance(loaded, list):
                    raise ValueError("audit trail is not a JSON array")
                existing = loaded
            except (ValueError, json.JSONDecodeError):
                # Keep the unreadable file (never delete history) and start a fresh array.
                AUDIT_PATH.rename(AUDIT_PATH.with_name(f"audit_trail.corrupt-{int(time.time())}.json"))
        existing.extend(entries)
        fd, tmp = tempfile.mkstemp(dir=AUDIT_PATH.parent, prefix=".audit_trail.", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(existing, f, ensure_ascii=False, indent=1)
                f.write("\n")
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, AUDIT_PATH)  # atomic swap: readers see the old or the new file, never half of one
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)
