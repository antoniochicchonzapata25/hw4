"""Database access for Campus Customs.

All paths are resolved from this file's location, so the backend works no matter
which directory Uvicorn is started from (normally `backend/`).
"""

import json
import re
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "campus_customs.db"
PRODUCTS_DIR = DATA_DIR / "products"

# Public URL prefix under which data/products/ is served (see main.py).
MEDIA_URL = "/media"

# Sizes are stored as text, so sort them in garment order, not alphabetically.
SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]


def get_connection() -> sqlite3.Connection:
    """Open a connection with dict-like rows and foreign keys enforced."""
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"Database not found at {DB_PATH}. Place the data pack in the project-root data/ folder."
        )
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """Connection that commits on success, rolls back on error, and always closes."""
    conn = get_connection()
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def _image_url(image_file_path: str) -> str:
    # catalogue.image_file_path is relative to data/, e.g. "products/x.jpg"
    return f"{MEDIA_URL}/{image_file_path}"


def _size_rank(size: str) -> int:
    return SIZE_ORDER.index(size) if size in SIZE_ORDER else len(SIZE_ORDER)


def _product_from_row(row: sqlite3.Row) -> dict:
    return {
        "product_id": row["product_id"],
        "name": row["name"],
        "garment_type": row["garment_type"],
        "description": row["description"],
        "colors": json.loads(row["colors"]),
        "search_tags": json.loads(row["search_tags"]),
        "image_file_path": row["image_file_path"],
        "image_url": _image_url(row["image_file_path"]),
        "price": row["price"],
    }


def list_products() -> list[dict]:
    """All catalogue products with their total stock across sizes."""
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT c.*, COALESCE(SUM(i.quantity), 0) AS total_stock
            FROM catalogue c
            LEFT JOIN inventory i ON i.product_id = c.product_id
            GROUP BY c.product_id
            ORDER BY c.name
            """
        ).fetchall()
    return [{**_product_from_row(r), "total_stock": r["total_stock"]} for r in rows]


def get_product(product_id: str) -> dict | None:
    """One product with its per-size inventory, or None if it doesn't exist."""
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if row is None:
            return None
        inv_rows = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
        ).fetchall()
    inventory = sorted(
        ({"size": r["size"], "quantity": r["quantity"]} for r in inv_rows),
        key=lambda x: _size_rank(x["size"]),
    )
    return {
        **_product_from_row(row),
        "inventory": inventory,
        "total_stock": sum(x["quantity"] for x in inventory),
    }



# ---------- Catalogue search (used by agent tools) ----------

# Words that carry no product meaning in a shopping question.
_STOPWORDS = {
    "a", "an", "the", "and", "or", "of", "for", "in", "on", "with", "to", "do", "you", "we",
    "have", "has", "is", "are", "any", "your", "me", "my", "i", "it", "this", "that", "these",
    "one", "some", "please", "show", "find", "looking", "look", "want", "need", "got", "sell",
    "what", "which", "kind", "kinds", "type", "types", "see", "available", "carry", "offer",
    "options", "like", "would", "can", "could", "all", "there", "anything", "something",
    "gear", "stuff", "merch", "merchandise", "clothes", "clothing", "apparel", "item", "items",
    "thing", "things", "product", "products", "wear", "buy", "get", "good", "nice", "new",
}

# Shopper category words -> a garment family. A family matches on catalogue.garment_type,
# because the labels aren't standardised ("hoodie", "pullover hoodie", "hooded sweatshirt"...).
_FAMILY_WORDS = {
    "hoodie": "hoodie", "hoody": "hoodie", "hooded": "hoodie", "hood": "hoodie",
    "crewneck": "crewneck",
    "sweatshirt": "sweatshirt", "sweater": "sweatshirt", "pullover": "sweatshirt",
    "tshirt": "tshirt",
    "quarterzip": "quarterzip",
    "jacket": "jacket", "fleece": "jacket", "coat": "jacket", "bomber": "jacket",
    "performance": "longsleeve", "longsleeve": "longsleeve",
    "mockneck": "mockneck",
}
# garment_type substrings that belong to each family.
_FAMILY_TYPES = {
    "hoodie": ("hood",),
    "crewneck": ("crewneck",),
    "sweatshirt": ("crewneck", "hood", "mockneck"),
    "tshirt": ("t-shirt",),
    "quarterzip": ("quarter-zip",),
    "jacket": ("jacket",),
    "longsleeve": ("long-sleeve", "performance"),
    "mockneck": ("mockneck",),
}
# Multi-word phrases rewritten before tokenising.
_PHRASES = [
    (r"\bt[\s-]?shirts?\b", " tshirt "),  # word boundaries: "sweatshirt" is not a T-shirt
    (r"\btees?\b", " tshirt "),
    (r"quarter[\s-]?zips?|1\s*/\s*4[\s-]?zips?", " quarterzip "),
    (r"crew[\s-]?necks?", " crewneck "),
    (r"long[\s-]?sleeves?", " longsleeve "),
    (r"mock[\s-]?necks?", " mockneck "),
    (r"\bl\s*/\s*s\b", " longsleeve "),
]
# Other shopper words -> catalogue words.
_SYNONYMS = {
    "grey": {"gray", "grey"},
    "gray": {"gray", "grey"},
    "zip": {"zip", "zipper"},
    "bulldog": {"bulldog", "bulldogs", "dog"},
    "harvard": {"harvard", "game"},
    "game": {"game", "harvard"},
    "rowing": {"rowing", "crew"},
    "row": {"rowing", "crew"},
}
# Words that may only match these fields ("crew" in a crewneck's name is not rowing).
_FIELD_LIMITS = {"rowing": ("search_tags", "description"), "row": ("search_tags", "description")}
_FIELD_WEIGHTS = {"name": 4, "product_id": 3, "garment_type": 3, "search_tags": 2, "colors": 1, "description": 1}
_NEUTRAL = {"yale"}  # on nearly every product, so it never decides a match by itself


def _normalise_text(text: str) -> str:
    text = text.lower()
    for pattern, repl in _PHRASES:
        text = re.sub(pattern, repl, text)
    return text


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", _normalise_text(text))


def _singular(word: str) -> str:
    if len(word) > 3 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def _word_options(word: str) -> set[str]:
    return {word, _singular(word)} | _SYNONYMS.get(word, set())


def search_catalogue(query: str, limit: int = 8) -> dict:
    """Find catalogue products for free-text shopper words.

    1. Category words (hoodies, tees, crewnecks, quarter zips, jackets...) select a garment
       family by garment_type, so every label variant is included.
    2. Remaining words (colours, sports, colleges, names) are scored against name, type,
       tags, colours and description. With a category, at least one of them must match.
    3. "Yale" and filler words ("gear", "stuff", "what") never decide a match.

    Returns {"total": int, "families": [...], "matches": [best `limit` products]}.
    """
    words = [_singular(w) for w in _tokens(query)]
    words = [w for w in words if w not in _STOPWORDS]
    families = sorted({_FAMILY_WORDS[w] for w in words if w in _FAMILY_WORDS})
    if "sweatshirt" in families and len(families) > 1:
        families.remove("sweatshirt")  # "hooded sweatshirt" / "crewneck sweatshirt": the specific family wins
    terms = [w for w in words if w not in _FAMILY_WORDS]
    meaningful = [w for w in terms if w not in _NEUTRAL]
    if not families and not meaningful:
        return {"total": 0, "families": [], "matches": []}

    with connect() as conn:
        rows = conn.execute(
            "SELECT product_id, name, garment_type, description, colors, search_tags FROM catalogue"
        ).fetchall()

    type_needles = [needle for f in families for needle in _FAMILY_TYPES[f]]
    q_text = " ".join(_tokens(query))
    scored = []
    for r in rows:
        garment = r["garment_type"].lower()
        if type_needles and not any(n in garment for n in type_needles):
            continue
        fields = {
            "name": set(_tokens(r["name"])),
            "product_id": set(_tokens(r["product_id"].replace("-", " "))),
            "garment_type": set(_tokens(r["garment_type"])),
            "search_tags": set(_tokens(" ".join(json.loads(r["search_tags"])))),
            "colors": set(_tokens(" ".join(json.loads(r["colors"])))),
            "description": set(_tokens(r["description"])),
        }
        score = 5 if families else 0
        matched = 0
        for w in meaningful:
            allowed = _FIELD_LIMITS.get(w, tuple(_FIELD_WEIGHTS))
            best = max((_FIELD_WEIGHTS[f] for f in allowed if _word_options(w) & fields[f]), default=0)
            score += best
            matched += best > 0
        if meaningful and matched == 0:
            continue  # nothing beyond the category (or "yale") matched
        name_text = " ".join(_tokens(r["name"]))
        if name_text and name_text in q_text:
            score += 10  # the shopper typed the full product name
        full = matched == len(meaningful)
        if full and meaningful:
            score += 3
        scored.append((score, r["name"], r, full))

    scored.sort(key=lambda x: (-x[0], x[1]))
    return {
        "total": len(scored),
        "families": families,
        "matches": [
            {
                "product_id": r["product_id"],
                "name": r["name"],
                "garment_type": r["garment_type"],
                "score": sc,
                "full_match": full,
            }
            for sc, _, r, full in scored[:limit]
        ],
    }


def _short_description(text: str, limit: int = 110) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(",;:-")
    return cut + "…"


def get_product_cards(product_ids: list[str]) -> list[dict]:
    """Card data for these products, in the given order. Unknown ids are skipped."""
    ids = list(dict.fromkeys(product_ids))  # de-duplicate, keep order
    if not ids:
        return []
    placeholders = ",".join("?" * len(ids))
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT c.product_id, c.name, c.garment_type, c.price, c.description, c.image_file_path,
                   COALESCE(SUM(i.quantity), 0) AS total_stock
            FROM catalogue c LEFT JOIN inventory i ON i.product_id = c.product_id
            WHERE c.product_id IN ({placeholders})
            GROUP BY c.product_id
            """,
            ids,
        ).fetchall()
    by_id = {r["product_id"]: r for r in rows}
    return [
        {
            "product_id": r["product_id"],
            "name": r["name"],
            "garment_type": r["garment_type"],
            "price_usd": r["price"],
            "short_description": _short_description(r["description"]),
            "image_url": _image_url(r["image_file_path"]),
            "in_stock": r["total_stock"] > 0,
        }
        for pid in ids
        if (r := by_id.get(pid)) is not None
    ]


# ---------- Users ----------

USER_COLUMNS = "id, name, email, first_name, last_name, created_at"


def _user_from_row(row: sqlite3.Row) -> dict:
    # first_name / last_name are nullable (added later via ALTER TABLE), so fall back to `name`.
    first, last = row["first_name"], row["last_name"]
    if first is None and last is None:
        first, _, last = row["name"].partition(" ")
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "first_name": first or "",
        "last_name": last or "",
        "created_at": row["created_at"],
    }


def get_user_by_id(user_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_from_row(row) if row else None


def get_user_credentials(email: str) -> tuple[dict, str] | None:
    """(user, password_hash) for a login attempt, matched case-insensitively."""
    with connect() as conn:
        row = conn.execute(
            f"SELECT {USER_COLUMNS}, password_hash FROM users WHERE lower(email) = lower(?)",
            (email,),
        ).fetchone()
    return (_user_from_row(row), row["password_hash"]) if row else None


class EmailAlreadyExists(Exception):
    pass


def create_user(first_name: str, last_name: str, email: str, password_hash: str) -> dict:
    """Insert a user, filling the required full-name column too. Email must already be normalised."""
    with connect() as conn:
        if conn.execute("SELECT 1 FROM users WHERE lower(email) = lower(?)", (email,)).fetchone():
            raise EmailAlreadyExists(email)
        try:
            cur = conn.execute(
                "INSERT INTO users (name, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
                (f"{first_name} {last_name}", email, password_hash, first_name, last_name),
            )
        except sqlite3.IntegrityError as exc:  # race with a concurrent signup
            raise EmailAlreadyExists(email) from exc
        row = conn.execute(f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _user_from_row(row)


# ---------- Chat history (Problem 8) ----------
# Uses the existing chat_messages table (id, user_id → users.id, role, content,
# products_json, created_at). Only logged-in users are saved; guests never are.
# products_json holds just the product ids shown as cards; card details (price,
# stock, image) are rebuilt from the catalogue when history is loaded, so they
# are never stale. Older seeded rows stored full product snapshots instead.


def _product_ids_from_json(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        items = json.loads(raw)
    except (TypeError, ValueError):
        return []
    ids = []
    for item in items if isinstance(items, list) else []:
        if isinstance(item, str):
            ids.append(item)                       # current format: ["id", ...]
        elif isinstance(item, dict) and isinstance(item.get("product_id"), str):
            ids.append(item["product_id"])         # seeded format: [{"product_id": ...}, ...]
    return ids


def get_chat_history(user_id: int, limit: int) -> list[dict]:
    """The user's most recent `limit` messages, oldest first."""
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, role, content, products_json, created_at
            FROM chat_messages
            WHERE user_id = ? AND role IN ('user', 'assistant')
            ORDER BY id DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "role": r["role"],
            "content": r["content"],
            "product_ids": _product_ids_from_json(r["products_json"]),
            "created_at": r["created_at"],
        }
        for r in reversed(rows)
    ]


def save_chat_exchange(user_id: int, user_message: str, reply: str, product_ids: list[str]) -> None:
    """Save one shopper message and the assistant's reply together (one transaction)."""
    with connect() as conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'user', ?, NULL)",
            (user_id, user_message),
        )
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
            (user_id, reply, json.dumps(product_ids) if product_ids else None),
        )


def count_chat_messages(user_id: int | None = None) -> int:
    with connect() as conn:
        if user_id is None:
            return conn.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0]
        return conn.execute("SELECT COUNT(*) FROM chat_messages WHERE user_id = ?", (user_id,)).fetchone()[0]


# ---------- Products page search (Problem 9) ----------


def search_product_ids(query: str) -> list[str]:
    """All product ids matching `query`, best first. Same search as the chatbot's find_products."""
    return [m["product_id"] for m in search_catalogue(query, limit=1000)["matches"]]


# ---------- Alternative recommendations (Problem 9) ----------

# Tag words too generic to say two products are related.
_GENERIC_TAGS = {
    "yale", "campus", "customs", "college", "apparel", "merch", "university", "logo", "graphic",
    "long", "sleeve", "short", "front", "chest", "left", "lettering", "wordmark", "sweatshirt",
    "shirt", "pullover", "navy", "blue", "white", "gray", "grey", "heather", "black", "classic",
    # garment construction words: they describe the cut, not the design or theme
    "hoodie", "hood", "hooded", "kangaroo", "pocket", "pockets", "drawstring", "zip", "zipper",
    "quarter", "quarterzip", "full", "half", "crewneck", "tshirt", "t", "tee", "ribbed", "cuff",
    "cuffs", "hem", "collar", "stand", "fleece", "jacket", "sleeve", "sleeves", "top", "layer",
    "casual", "comfortable", "soft", "cotton", "men", "mens", "women", "unisex", "fit",
}


def garment_family(garment_type: str) -> str | None:
    """The search family a garment type belongs to (most specific first)."""
    g = garment_type.lower()
    for family in ("hoodie", "quarterzip", "mockneck", "longsleeve", "jacket", "tshirt", "crewneck"):
        if any(needle in g for needle in _FAMILY_TYPES[family]):
            return family
    return None


def find_alternatives(product_id: str, size: str | None, limit: int = 3) -> dict | None:
    """In-stock products similar to `product_id` (same garment family), best first.

    With `size`, only products that have that size in stock are returned. Ranked by shared
    themes in their tags (sport, college, design), then shared colours, then closeness in
    price. Returns None if the product doesn't exist.
    """
    with connect() as conn:
        ref = conn.execute(
            "SELECT product_id, name, garment_type, price, colors, search_tags FROM catalogue WHERE product_id = ?",
            (product_id,),
        ).fetchone()
        if ref is None:
            return None
        rows = conn.execute(
            """
            SELECT c.product_id, c.name, c.garment_type, c.price, c.colors, c.search_tags,
                   COALESCE(SUM(i.quantity), 0) AS total_stock,
                   COALESCE(SUM(CASE WHEN i.size = ? THEN i.quantity END), 0) AS size_stock
            FROM catalogue c LEFT JOIN inventory i ON i.product_id = c.product_id
            WHERE c.product_id != ?
            GROUP BY c.product_id
            """,
            (size or "", product_id),
        ).fetchall()

    family = garment_family(ref["garment_type"])
    ref_tags = set(_tokens(" ".join(json.loads(ref["search_tags"])))) - _GENERIC_TAGS
    ref_colors = set(_tokens(" ".join(json.loads(ref["colors"]))))
    candidates = []
    for r in rows:
        if family is None or garment_family(r["garment_type"]) != family:
            continue  # only the same kind of garment counts as an alternative
        available = r["size_stock"] if size else r["total_stock"]
        if available <= 0:
            continue  # never suggest something that is itself unavailable
        shared_tags = ref_tags & (set(_tokens(" ".join(json.loads(r["search_tags"])))) - _GENERIC_TAGS)
        shared_colors = ref_colors & set(_tokens(" ".join(json.loads(r["colors"]))))
        score = 3 * len(shared_tags) + len(shared_colors) - abs(r["price"] - ref["price"]) / 20
        candidates.append((score, r["name"], r, sorted(shared_tags), sorted(shared_colors), available))

    candidates.sort(key=lambda x: (-x[0], x[1]))
    return {
        "reference": {"product_id": ref["product_id"], "name": ref["name"], "garment_type": ref["garment_type"]},
        "family": family,
        "size": size,
        "alternatives": [
            {
                "product_id": r["product_id"],
                "name": r["name"],
                "garment_type": r["garment_type"],
                "price": r["price"],
                "available_quantity": available,
                "shared_themes": tags[:4],
                "shared_colors": colors[:3],
            }
            for _, _, r, tags, colors, available in candidates[:limit]
        ],
        "total_candidates": len(candidates),
    }


# ---------- Out-of-stock demand (Problem 9) ----------


def ensure_demand_table() -> None:
    """Create the demand_events table if it doesn't exist (additive; no existing data changes)."""
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS demand_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id TEXT NOT NULL REFERENCES catalogue(product_id),
                size TEXT,                                  -- NULL = whole product sold out
                user_id INTEGER REFERENCES users(id),       -- NULL for guests
                source TEXT NOT NULL DEFAULT 'chat',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_demand_product_size ON demand_events (product_id, size)"
        )


def record_demand(product_id: str, size: str | None, user_id: int | None, source: str = "chat") -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO demand_events (product_id, size, user_id, source) VALUES (?, ?, ?, ?)",
            (product_id, size, user_id, source),
        )


def demand_report() -> list[dict]:
    """Unmet demand grouped by product and size, most requested first, with current stock."""
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT d.product_id, c.name, d.size,
                   COUNT(*) AS requests,
                   COUNT(DISTINCT d.user_id) AS logged_in_shoppers,
                   SUM(d.user_id IS NULL) AS guest_requests,
                   MIN(d.created_at) AS first_requested,
                   MAX(d.created_at) AS last_requested,
                   CASE WHEN d.size IS NULL
                        THEN (SELECT COALESCE(SUM(quantity), 0) FROM inventory WHERE product_id = d.product_id)
                        ELSE (SELECT quantity FROM inventory WHERE product_id = d.product_id AND size = d.size)
                   END AS current_stock
            FROM demand_events d JOIN catalogue c ON c.product_id = d.product_id
            GROUP BY d.product_id, d.size
            ORDER BY requests DESC, last_requested DESC
            """
        ).fetchall()
    return [dict(r) for r in rows]


# ---------- Shopping bag quote (Problem 9) ----------


def quote_bag(items: list[dict]) -> dict:
    """Price a shopping bag with live catalogue prices and stock. Nothing is reserved or saved."""
    lines, subtotal = [], 0.0
    for item in items:
        product = get_product(item["product_id"])
        if product is None:
            lines.append({**item, "available": False, "problem": "This product is no longer available."})
            continue
        stock = next((s["quantity"] for s in product["inventory"] if s["size"] == item["size"]), None)
        line = {
            "product_id": product["product_id"],
            "name": product["name"],
            "image_url": product["image_url"],
            "size": item["size"],
            "requested_quantity": item["quantity"],
            "unit_price": product["price"],
            "stock": stock or 0,
        }
        if stock is None:
            line.update(available=False, quantity=0, line_total=0.0, problem="That size isn't offered.")
        elif stock <= 0:
            line.update(available=False, quantity=0, line_total=0.0, problem=f"Size {item['size']} is now out of stock.")
        else:
            qty = min(item["quantity"], stock)
            line.update(
                available=True,
                quantity=qty,
                line_total=round(qty * product["price"], 2),
                problem=None if qty == item["quantity"] else f"Only {stock} left in size {item['size']}.",
            )
            subtotal += line["line_total"]
        lines.append(line)
    return {
        "lines": lines,
        "item_count": sum(l.get("quantity", 0) for l in lines),
        "subtotal": round(subtotal, 2),
    }
