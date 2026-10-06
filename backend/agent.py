"""Campus Customs PydanticAI agent: model setup, agent creation and a run helper.

Configuration comes from the environment (never from source code):
    PORTKEY_API_KEY   required. Read from hw4/.env, then the course-root .env.
    OPENAI_MODEL      optional, default gpt-5.6-luna (any 5.6 / 6 series model).
    PORTKEY_BASE_URL  optional, default https://api.portkey.ai/v1
"""

import logging
import os
from collections.abc import Callable
from functools import lru_cache
from pathlib import Path

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")  # keep the server log clean

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic_ai import Agent, NativeOutput, RunContext
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits

import audit
from models import MAX_HISTORY_TURNS, MAX_PRODUCT_CARDS, AgentReply, ChatTurn, ShopDeps
from tools import TOOLS

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent          # hw4/
COURSE_ROOT = PROJECT_ROOT.parents[2]      # hw4 → HW4 → Homework → course folder (shared .env)
PROMPT_PATH = BACKEND_DIR / "prompts" / "prompt.md"

log = logging.getLogger("uvicorn.error")  # shows up in the Uvicorn console

# First value found wins: the project's own .env, then the course-root .env.
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(COURSE_ROOT / ".env")

MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-5.6-luna")
PORTKEY_BASE_URL = os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1")
MODEL_TIMEOUT_SECONDS = 45
# Model calls allowed per chat message. A lookup is usually 2-3 calls (find → stock/price → answer);
# the cap stops runaway tool loops.
USAGE_LIMITS = UsageLimits(request_limit=8)


class AgentNotConfigured(RuntimeError):
    """Raised when the API key is missing, so the API can answer with a clear 503."""


def is_configured() -> bool:
    return bool(os.getenv("PORTKEY_API_KEY"))


def build_model() -> OpenAIResponsesModel:
    api_key = os.getenv("PORTKEY_API_KEY")
    if not api_key:
        raise AgentNotConfigured("PORTKEY_API_KEY is not set. Add it to .env (see .env.example).")
    client = AsyncOpenAI(
        api_key=api_key,
        base_url=PORTKEY_BASE_URL,
        default_headers={"x-portkey-provider": "openai"},
        timeout=MODEL_TIMEOUT_SECONDS,
        max_retries=1,
    )
    return OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client))


def shopper_context(ctx: RunContext[ShopDeps]) -> str:
    """Per-request instructions built from server-side deps (session + validated page)."""
    lines = ["## Current shopper and page (set by the website, not by the shopper)"]
    customer = ctx.deps.customer
    if customer:
        lines.append(
            f"- Logged-in customer: {customer.first_name} {customer.last_name}, email {customer.email}."
        )
    else:
        lines.append("- The shopper is a guest (not logged in). You don't know their name or email.")
    product = ctx.deps.current_product
    if product:
        lines.append(
            f"- They are viewing the product page for \"{product.name}\" "
            f"(product_id: {product.product_id}, {product.garment_type}) right now. "
            f"In this message, \"this\", \"this one\" or \"it\" means {product.name}, even if earlier "
            "messages were about other products, unless the shopper names a different product in this message."
        )
    else:
        lines.append(
            "- They are not on a product page right now, so there is no current product. "
            "Products from earlier pages are not on screen any more."
        )
    return "\n".join(lines)


@lru_cache(maxsize=1)
def get_agent() -> Agent[ShopDeps, AgentReply]:
    """Build the agent once, on first use, so the API can start even without a key."""
    return Agent(
        build_model(),
        name="CampusCustomsAssistant",
        deps_type=ShopDeps,
        # Static prompt file + per-request shopper/page context (Problem 8).
        instructions=[PROMPT_PATH.read_text(encoding="utf-8"), shopper_context],
        tools=TOOLS,
        # reply text + product_ids for cards (Problem 7). NativeOutput = the model's JSON
        # structured-output mode, so tool calls stay optional (tool-based output would force
        # a tool call every turn and made the agent search the catalogue for "hi").
        output_type=NativeOutput(AgentReply),
        retries=2,
    )


def to_message_history(history: list[ChatTurn]) -> list[ModelMessage]:
    """Turn the browser's {role, content} turns into PydanticAI message history."""
    messages: list[ModelMessage] = []
    for turn in history[-MAX_HISTORY_TURNS:]:
        if not turn.content.strip():
            continue
        if turn.role == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=turn.content)]))
        else:
            messages.append(ModelResponse(parts=[TextPart(content=turn.content)]))
    return messages


def _ids_from_tool_results(messages: list[ModelMessage]) -> set[str]:
    """product_ids that the agent's own tools returned in this run."""
    ids: set[str] = set()
    for msg in messages:
        for part in getattr(msg, "parts", []):
            if not isinstance(part, ToolReturnPart):
                continue
            content = part.content
            for match in getattr(content, "matches", None) or []:
                ids.add(match.product_id)
            for alt in getattr(content, "alternatives", None) or []:
                ids.add(alt.product_id)
            if getattr(content, "found", True) and getattr(content, "product_id", None):
                ids.add(content.product_id)
    return ids


async def run_chat(message: str, history: list[ChatTurn], deps: ShopDeps) -> AgentReply:
    """Send one shopper message (plus earlier turns) to the agent.

    Returns the reply text and the product_ids to show as cards. Ids are kept only if
    a tool returned them in this run, so the model can't put an unsearched or made-up
    product on the page. Card details are then loaded from the database by the API.
    """
    run_id = audit.new_run_id()
    who = "logged_in" if deps.customer else "guest"
    page_id = deps.current_product.product_id if deps.current_product else None
    try:
        result = await get_agent().run(
            message,
            message_history=to_message_history(history),
            deps=deps,
            usage_limits=USAGE_LIMITS,
        )
    except Exception as exc:
        _safe_audit([audit.error_entry(run_id, shopper=who, page_product_id=page_id, model=MODEL_NAME, error=exc)])
        raise
    new = result.new_messages()
    calls = [
        f"{part.tool_name}({part.args_as_json_str()})"
        for msg in new
        if isinstance(msg, ModelResponse)
        for part in msg.parts
        if isinstance(part, ToolCallPart)
    ]
    allowed = _ids_from_tool_results(new)
    wanted = list(dict.fromkeys(result.output.product_ids))
    kept = [pid for pid in wanted if pid in allowed][:MAX_PRODUCT_CARDS]
    dropped = [pid for pid in wanted if pid not in allowed]
    log.info(
        "chat [%s | page=%s] tools: %s | cards: %s%s",
        f"user {deps.customer.user_id}" if deps.customer else "guest",
        deps.current_product.product_id if deps.current_product else "-",
        "; ".join(calls) if calls else "none",
        kept or "none",
        f" | dropped (not from tools): {dropped}" if dropped else "",
    )
    reply = result.output.reply.strip()

    def build_entries() -> list[dict]:
        usage = result.usage() if callable(result.usage) else result.usage  # property in PydanticAI 2.x
        return audit.entries_from_run(
            run_id,
            new,
            shopper=who,
            page_product_id=page_id,
            model=MODEL_NAME,
            reply_chars=len(reply),
            card_ids=kept,
            usage={
                "requests": usage.requests,
                "tool_calls": len(calls),
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
            },
        )

    _safe_audit(build_entries)
    return AgentReply(reply=reply, product_ids=kept)


def is_content_filter(error: BaseException) -> bool:
    """True when the model provider rejected the prompt with its content/jailbreak filter."""
    return "content_filter" in str(getattr(error, "body", "") or "") or "content_filter" in str(error)


def _safe_audit(entries: list[dict] | Callable[[], list[dict]]) -> None:
    """Build + write audit entries; any audit failure is logged but never breaks the shopper's chat."""
    try:
        audit.append_entries(entries() if callable(entries) else entries)
    except Exception:
        log.exception("could not write audit trail")
