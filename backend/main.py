"""Campus Customs API.

Run from the backend/ folder:
    uvicorn main:app --reload --port 8000

Serves the product catalogue, product images, account auth (register / login /
logout / me), and the shopping-assistant chat (POST /api/chat → PydanticAI agent).
"""

import hmac
import logging
import os
import re
from typing import Annotated

from fastapi import Cookie, FastAPI, Header, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

import agent
import auth
import db
from models import (
    MAX_HISTORY_DISPLAY,
    BagQuote,
    BagQuoteRequest,
    DemandReport,
    MAX_HISTORY_TURNS,
    ChatHistoryResponse,
    ChatRequest,
    ChatResponse,
    ChatTurn,
    CurrentProduct,
    CustomerContext,
    HistoryMessage,
    PageContext,
    ProductCard,
    ShopDeps,
)

log = logging.getLogger("campus_customs")

app = FastAPI(title="Campus Customs API")

# Additive table for out-of-stock demand (Problem 9); no existing data is changed.
db.ensure_demand_table()

# The Vite dev server proxies /api and /media, but allow direct calls in dev too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SizeStock(BaseModel):
    size: str
    quantity: int


class ProductSummary(BaseModel):
    product_id: str
    name: str
    garment_type: str
    description: str
    colors: list[str]
    search_tags: list[str]
    image_file_path: str
    image_url: str
    price: float
    total_stock: int


class ProductDetail(ProductSummary):
    inventory: list[SizeStock]


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "database": db.DB_PATH.exists(),
        "agent_configured": agent.is_configured(),
        "model": agent.MODEL_NAME,
    }


@app.get("/api/products", response_model=list[ProductSummary])
def products(q: Annotated[str | None, Query(max_length=100)] = None) -> list[dict]:
    """All products, or with ?q= only those matching the search, best match first.

    Uses the same catalogue search as the chatbot (db.search_catalogue), so "hoodies",
    "navy quarter zip" or "hockey tee" find the same products in both places.
    """
    items = db.list_products()
    if not q or not q.strip():
        return items
    by_id = {p["product_id"]: p for p in items}
    return [by_id[pid] for pid in db.search_product_ids(q) if pid in by_id]


@app.get("/api/products/{product_id}", response_model=ProductDetail)
def product(product_id: str) -> dict:
    item = db.get_product(product_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")
    return item


# ---------- Auth ----------

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 8


def _normalise_email(value: str) -> str:
    value = value.strip().lower()
    if not EMAIL_RE.match(value):
        raise ValueError("Enter a valid email address.")
    return value


class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return _normalise_email(v)

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        if len(v) < MIN_PASSWORD:
            raise ValueError(f"Password must be at least {MIN_PASSWORD} characters.")
        return v


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    first_name: str
    last_name: str


SessionCookie = Annotated[str | None, Cookie(alias=auth.SESSION_COOKIE)]


def _start_session(response: Response, user_id: int) -> None:
    response.set_cookie(
        auth.SESSION_COOKIE,
        auth.create_session_token(user_id),
        max_age=auth.SESSION_MAX_AGE,
        httponly=True,   # not readable from JavaScript
        samesite="lax",  # not sent on cross-site POSTs
        secure=False,    # local dev runs over http; set True behind https
        path="/",
    )


def current_user(session: str | None) -> dict | None:
    user_id = auth.read_session_token(session)
    return db.get_user_by_id(user_id) if user_id is not None else None


@app.post("/api/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, response: Response) -> dict:
    try:
        user = db.create_user(
            body.first_name, body.last_name, body.email, auth.hash_password(body.password)
        )
    except db.EmailAlreadyExists:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    _start_session(response, user["id"])  # signed in right after signing up
    return user


@app.post("/api/auth/login", response_model=UserOut)
def login(body: LoginRequest, response: Response) -> dict:
    found = db.get_user_credentials(body.email.strip())
    if found is None:
        auth.burn_time(body.password)
    elif auth.verify_password(body.password, found[1]):
        _start_session(response, found[0]["id"])
        return found[0]
    # Same message whether the email or the password was wrong.
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(auth.SESSION_COOKIE, path="/")


@app.get("/api/auth/me", response_model=UserOut | None)
def me(cc_session: SessionCookie = None) -> dict | None:
    """The logged-in user, or null for guests (200 either way, so guests don't log errors)."""
    return current_user(cc_session)


# ---------- Chat ----------

def _customer_context(user: dict | None) -> CustomerContext | None:
    if user is None:
        return None
    return CustomerContext(
        user_id=user["id"],
        first_name=user["first_name"],
        last_name=user["last_name"],
        email=user["email"],
    )


def _current_product(page: PageContext | None) -> CurrentProduct | None:
    """Trust only a product_id that exists in the catalogue; take its name from the database."""
    if page is None or not page.product_id:
        return None
    item = db.get_product(page.product_id.strip())
    if item is None:
        return None
    return CurrentProduct(product_id=item["product_id"], name=item["name"], garment_type=item["garment_type"])


def _cards(product_ids: list[str]) -> list[ProductCard]:
    # Cards always come from the database (live price/stock), never from the model or the browser.
    return [ProductCard(**c) for c in db.get_product_cards(product_ids)]


@app.get("/api/chat/history", response_model=ChatHistoryResponse)
def chat_history(cc_session: SessionCookie = None) -> ChatHistoryResponse:
    """The logged-in shopper's saved conversation (most recent messages). Guests get none.

    The owner comes only from the signed session cookie; there is no user id parameter,
    so one account can never request another account's history.
    """
    user = current_user(cc_session)
    if user is None:
        return ChatHistoryResponse(logged_in=False, messages=[])
    rows = db.get_chat_history(user["id"], limit=MAX_HISTORY_DISPLAY)
    return ChatHistoryResponse(
        logged_in=True,
        messages=[
            HistoryMessage(
                id=r["id"],
                role=r["role"],
                content=r["content"],
                products=_cards(r["product_ids"]) if r["role"] == "assistant" else [],
                created_at=r["created_at"],
            )
            for r in rows
        ],
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, cc_session: SessionCookie = None) -> ChatResponse:
    """One shopper message in, one assistant reply out.

    Logged in: history comes from the database and the exchange is saved there.
    Guest: history comes from the browser and nothing is saved.
    """
    user = current_user(cc_session)
    deps = ShopDeps(customer=_customer_context(user), current_product=_current_product(body.page))
    if user is not None:
        saved = db.get_chat_history(user["id"], limit=MAX_HISTORY_TURNS)
        history = [ChatTurn(role=m["role"], content=m["content"]) for m in saved]
    else:
        history = body.history

    try:
        result = await agent.run_chat(body.message, history, deps)
    except agent.AgentNotConfigured:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The shopping assistant isn't configured yet. Please try again later.",
        )
    except Exception as exc:
        if agent.is_content_filter(exc):
            # The model provider's safety filter rejected the message (e.g. a jailbreak attempt).
            # Answer with a polite refusal instead of an "assistant is broken" error; nothing is saved.
            log.warning("chat blocked by the model provider's content filter")
            return ChatResponse(
                reply=(
                    "Sorry, I can't help with that. I'm here to help you shop Campus Customs: "
                    "finding Yale gear, checking sizes and stock, or picking a gift."
                ),
                products=[],
                logged_in=user is not None,
            )
        # Model/network failure: log details server-side, return a safe message to the browser.
        log.exception("Chat agent failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "The shopping assistant is having trouble right now. Please try again in a moment.",
        )
    reply = result.reply or "Sorry, I didn't catch that. Could you rephrase your question?"
    cards = _cards(result.product_ids)
    if user is not None:
        db.save_chat_exchange(user["id"], body.message, reply, [c.product_id for c in cards])
    return ChatResponse(reply=reply, products=cards, logged_in=user is not None)


# ---------- Shopping bag (Problem 9) ----------

@app.post("/api/bag/quote", response_model=BagQuote)
def bag_quote(body: BagQuoteRequest) -> dict:
    """Price the shopper's bag with live catalogue prices and stock.

    The bag itself lives in the browser; this only reads the database. Nothing is
    reserved, ordered or charged.
    """
    return db.quote_bag([item.model_dump() for item in body.items])


# ---------- Manager: out-of-stock demand (Problem 9) ----------

@app.get("/api/manager/demand", response_model=DemandReport)
def manager_demand(x_manager_key: Annotated[str | None, Header()] = None) -> DemandReport:
    """Unmet demand report for the store manager. Requires the X-Manager-Key header.

    Shows products/sizes shoppers asked for while unavailable, with counts and current
    stock. No customer names or emails, only counts of accounts and guests.
    """
    expected = os.getenv("MANAGER_API_KEY")
    if not expected:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Manager report is not configured.")
    if not x_manager_key or not hmac.compare_digest(x_manager_key, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Manager key required.")
    rows = db.demand_report()
    return DemandReport(rows=rows, total_requests=sum(r["requests"] for r in rows))


# Serve only the product images folder — never the whole data/ folder (it holds the .db).
app.mount(
    f"{db.MEDIA_URL}/products",
    StaticFiles(directory=db.PRODUCTS_DIR),
    name="product-images",
)
