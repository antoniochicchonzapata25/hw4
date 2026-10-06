"""Structured types for the Campus Customs chat agent and its API."""

from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field

MAX_MESSAGE_CHARS = 2000
MAX_HISTORY_TURNS = 20
MAX_PRODUCT_CARDS = 8
MAX_HISTORY_DISPLAY = 50  # messages restored into the chat window for a logged-in user


class ChatTurn(BaseModel):
    """One earlier message in the current conversation."""

    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class PageContext(BaseModel):
    """Where the shopper is on the site when they send a message (Problem 8).

    Sent by the frontend from the current route. Only the product_id is taken from the
    browser; the backend checks it against the catalogue and looks up the name itself.
    """

    path: str | None = Field(default=None, max_length=200)
    product_id: str | None = Field(default=None, max_length=200)


class ChatRequest(BaseModel):
    """Body of POST /api/chat."""

    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    # Guests only: earlier turns from this browser session, oldest first. For logged-in
    # shoppers the server ignores this and loads the saved history from the database.
    history: list[ChatTurn] = Field(default_factory=list)
    page: PageContext | None = None


class ProductCard(BaseModel):
    """One product card shown in the chat and on the page (Problem 7).

    Built by the backend from the catalogue/inventory tables, never by the model.
    """

    product_id: str          # route to the existing detail page: /products/<product_id>
    name: str                # card title
    garment_type: str        # small label above the title ("pullover hoodie")
    price_usd: float         # price shown on the card, read live from the catalogue
    short_description: str   # first ~110 characters of the description, cut at a word
    image_url: str           # /media/products/<file>.jpg, served by FastAPI
    in_stock: bool           # False → "Sold out" badge (no size in stock)


class ChatResponse(BaseModel):
    """Body returned by POST /api/chat.

    `products` is empty for normal conversation and filled when the agent shows
    catalogue matches (e.g. "What hoodies do you have?").
    """

    reply: str
    products: list[ProductCard] = Field(default_factory=list)
    # Whether the server treated this request as a logged-in customer (from the session
    # cookie). Lets the frontend notice an expired/invalid session and refresh its state.
    logged_in: bool = False


class HistoryMessage(BaseModel):
    """One saved message, as restored into the chat window."""

    id: int
    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list)
    created_at: str


class ChatHistoryResponse(BaseModel):
    """Body returned by GET /api/chat/history."""

    logged_in: bool
    messages: list[HistoryMessage] = Field(default_factory=list)


# ---------- Agent dependencies (Problem 8) ----------
# Built by the backend for every chat request from the session cookie and the
# validated page context. The shopper can't set these by typing in the chat.


@dataclass(frozen=True)
class CustomerContext:
    user_id: int
    first_name: str
    last_name: str
    email: str


@dataclass(frozen=True)
class CurrentProduct:
    product_id: str
    name: str
    garment_type: str


@dataclass(frozen=True)
class ShopDeps:
    customer: CustomerContext | None = None        # None = guest
    current_product: CurrentProduct | None = None  # None = not on a product page
    # (product_id, size) demand already recorded in this request, so one question
    # counts once even if the agent checks stock twice (Problem 9).
    recorded_demand: set[tuple[str, str | None]] = field(default_factory=set)


class AgentReply(BaseModel):
    """The agent's structured final answer (its output_type)."""

    reply: str = Field(description="Plain-text message to the shopper.")
    product_ids: list[str] = Field(
        default_factory=list,
        description=(
            "Exact product_id values, from tool results in this turn, to show as product cards. "
            f"Best first, at most {MAX_PRODUCT_CARDS}. Empty list when no cards should be shown."
        ),
    )


# ---------- Tool results (Problem 6) ----------
# What the agent sees when it calls a tool. Only the fields it needs to answer a
# shopper: no file paths, image URLs, row ids or other database internals.


class ProductMatch(BaseModel):
    """A catalogue product that matches the shopper's words (used to pick the right product_id)."""

    product_id: str
    name: str
    garment_type: str
    # False when only some of the shopper's words matched (e.g. "lacrosse beanie" → a lacrosse crewneck).
    matches_every_word: bool


class ProductMatches(BaseModel):
    query: str
    total_matches: int       # how many products matched in all (matches holds the best few)
    matches: list[ProductMatch]
    note: str | None = None


class ProductInfo(BaseModel):
    product_id: str
    name: str
    garment_type: str
    description: str
    # Colours that appear on this one garment (base colour + print/crest). Each product is a
    # single colourway; this is NOT a list of colour options to choose from.
    colors_in_design: list[str]
    price_usd: float


class ProductPrice(BaseModel):
    product_id: str
    name: str
    price_usd: float


class SizeStock(BaseModel):
    size: str
    quantity: int
    in_stock: bool


class ProductStock(BaseModel):
    """Live inventory for one product, sizes always in XS → XXL order."""

    product_id: str
    name: str
    sizes: list[SizeStock]
    total_quantity: int
    in_stock_sizes: list[str]
    out_of_stock_sizes: list[str]
    # Filled only when the shopper asked about one size.
    requested_size: str | None = None
    requested_size_quantity: int | None = None
    requested_size_in_stock: bool | None = None


class LookupProblem(BaseModel):
    """Returned instead of a result when the product or size can't be found."""

    found: bool = False
    problem: str
    product_id: str | None = None
    valid_sizes: list[str] | None = None


# ---------- Alternatives tool result (Problem 9) ----------


class AlternativeProduct(BaseModel):
    product_id: str
    name: str
    garment_type: str
    price_usd: float
    # Units in stock for the requested size (or across all sizes if no size was asked).
    available_quantity: int
    shared_themes: list[str]   # e.g. ["hockey", "sports"]: why it's related
    shared_colors: list[str]


class Alternatives(BaseModel):
    for_product_id: str
    for_product_name: str
    size: str | None
    alternatives: list[AlternativeProduct]
    note: str | None = None


# ---------- Shopping bag (Problem 9) ----------
# The bag lives in the browser. The backend only prices it with live catalogue data.
# Nothing is reserved, ordered or charged.


class BagItem(BaseModel):
    product_id: str = Field(min_length=1, max_length=200)
    size: str = Field(min_length=1, max_length=5)
    quantity: int = Field(ge=1, le=20)


class BagQuoteRequest(BaseModel):
    items: list[BagItem] = Field(default_factory=list, max_length=50)


class BagLine(BaseModel):
    product_id: str
    name: str | None = None
    image_url: str | None = None
    size: str
    requested_quantity: int | None = None
    quantity: int = 0            # what can actually be bought now (capped at stock)
    unit_price: float | None = None
    stock: int = 0
    line_total: float = 0.0
    available: bool
    problem: str | None = None


class BagQuote(BaseModel):
    lines: list[BagLine]
    item_count: int
    subtotal: float


# ---------- Out-of-stock demand report (Problem 9) ----------


class DemandRow(BaseModel):
    product_id: str
    name: str
    size: str | None             # None = the whole product was sold out
    requests: int
    logged_in_shoppers: int      # distinct accounts (no names or emails are exposed)
    guest_requests: int
    first_requested: str
    last_requested: str
    current_stock: int | None


class DemandReport(BaseModel):
    rows: list[DemandRow]
    total_requests: int
