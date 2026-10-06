"""Tools the Campus Customs agent can call.

Every fact about a product (name, description, colours, price, stock) comes from
data/campus_customs.db at the moment the tool is called, through the helpers in
db.py (which open, commit and close their own connections). Tools return small
Pydantic models (models.py) with only what the agent needs to answer.

Typical flows:
    "Is the Crew Left Chest Hoodie in stock in medium?"
        find_products("crew left chest hoodie")     -> product_id
        get_product_stock(product_id, size="M")     -> live quantity for M
    "What hoodies do you have?"  (Problem 7)
        find_products("hoodies", max_results=8)     -> product_ids for the cards
"""

import logging
from collections.abc import Callable
from typing import Any

from pydantic_ai import RunContext

import db
from models import (
    AlternativeProduct,
    Alternatives,
    LookupProblem,
    ProductInfo,
    ProductMatch,
    ProductMatches,
    ProductPrice,
    ProductStock,
    ShopDeps,
    SizeStock,
)

log = logging.getLogger("uvicorn.error")

MAX_MATCHES = 8  # also the max number of product cards per reply

# Words shoppers use for sizes → the size codes stored in the inventory table.
_SIZE_ALIASES = {
    "xs": "XS", "x-small": "XS", "xsmall": "XS", "extra small": "XS", "extra-small": "XS",
    "s": "S", "sm": "S", "small": "S",
    "m": "M", "med": "M", "medium": "M",
    "l": "L", "lg": "L", "large": "L",
    "xl": "XL", "x-large": "XL", "xlarge": "XL", "extra large": "XL", "extra-large": "XL",
    "xxl": "XXL", "2xl": "XXL", "xx-large": "XXL", "xxlarge": "XXL", "2x": "XXL",
    "double extra large": "XXL", "extra extra large": "XXL",
}


def _normalise_size(size: str) -> str | None:
    key = " ".join(size.strip().lower().split())
    return _SIZE_ALIASES.get(key) or (key.upper() if key.upper() in db.SIZE_ORDER else None)


def _not_found(product_id: str) -> LookupProblem:
    return LookupProblem(
        problem=f"No product with id '{product_id}'. Use find_products to look up the right product_id first.",
        product_id=product_id,
    )


def find_products(query: str, max_results: int = MAX_MATCHES) -> ProductMatches:
    """Search the catalogue for products matching the shopper's words.

    Use it in two situations:
    - To identify one product the shopper names ("the basic hoodie big yale"), so the
      other tools get an exact product_id.
    - To browse a category or theme ("hoodies", "crewnecks", "rowing", "navy quarter
      zips", "bulldog shirts"). Category words match every label variant in the
      catalogue (e.g. hoodies include "pullover hoodie" and "hooded sweatshirt").

    Returns the best matches first, plus total_matches (how many matched overall).
    If there are no matches, or none has matches_every_word=true, the exact item the
    shopper asked for may not exist: say so instead of guessing.

    Args:
        query: The shopper's words, e.g. "hoodies", "hockey t-shirt", "basic hoodie big yale".
        max_results: How many matches to return (1-8). Use 8 for browsing, fewer to identify one item.
    """
    limit = max(1, min(max_results, MAX_MATCHES))
    found = db.search_catalogue(query, limit=limit)
    matches = [
        ProductMatch(
            product_id=r["product_id"],
            name=r["name"],
            garment_type=r["garment_type"],
            matches_every_word=r["full_match"],
        )
        for r in found["matches"]
    ]
    note = None
    if not matches:
        note = "No products matched. Tell the shopper you couldn't find that; do not guess or show cards."
    elif not any(m.matches_every_word for m in matches):
        note = "Only partial matches. The exact item asked for may not be in the catalogue."
    elif found["total"] > len(matches):
        note = f"Showing the best {len(matches)} of {found['total']} matches. Offer to narrow down (colour, sport, college)."
    return ProductMatches(query=query, total_matches=found["total"], matches=matches, note=note)


def get_product_info(product_id: str) -> ProductInfo | LookupProblem:
    """Get a product's name, garment type, full description, design colours and current price.

    Use for questions about what a product is, what it looks like, its colours or details.
    colors_in_design lists the colours printed or dyed on this single garment (e.g. a gray
    fleece with a blue/red crest). It is not a choice of colourways: each product comes in
    one colourway only.

    Args:
        product_id: Exact product_id from find_products, e.g. "basic-hoodie-big-yale".
    """
    item = db.get_product(product_id.strip())
    if item is None:
        return _not_found(product_id)
    return ProductInfo(
        product_id=item["product_id"],
        name=item["name"],
        garment_type=item["garment_type"],
        description=item["description"],
        colors_in_design=item["colors"],
        price_usd=item["price"],
    )


def get_product_price(product_id: str) -> ProductPrice | LookupProblem:
    """Get a product's current price in US dollars, read live from the catalogue.

    Always call this before stating a price. Never estimate or reuse a remembered price.

    Args:
        product_id: Exact product_id from find_products.
    """
    item = db.get_product(product_id.strip())
    if item is None:
        return _not_found(product_id)
    return ProductPrice(product_id=item["product_id"], name=item["name"], price_usd=item["price"])


def get_product_stock(
    ctx: RunContext[ShopDeps], product_id: str, size: str | None = None
) -> ProductStock | LookupProblem:
    """Get current stock for a product from the inventory table, per size (XS, S, M, L, XL, XXL).

    Always call this before saying whether something is available or how many are left.
    A quantity of 0 means that size is out of stock. Use it only for products the shopper
    asked about; to check alternatives, use find_alternatives instead.

    Args:
        product_id: Exact product_id from find_products.
        size: Optional size the shopper asked about, e.g. "M", "medium", "XL" or "2XL".
    """
    item = db.get_product(product_id.strip())
    if item is None:
        return _not_found(product_id)

    requested = None
    if size is not None and size.strip():
        requested = _normalise_size(size)
        if requested is None:
            return LookupProblem(
                problem=f"'{size}' is not a size we carry.",
                product_id=item["product_id"],
                valid_sizes=list(db.SIZE_ORDER),
            )

    sizes = [SizeStock(size=s["size"], quantity=s["quantity"], in_stock=s["quantity"] > 0) for s in item["inventory"]]
    by_size = {s.size: s for s in sizes}
    result = ProductStock(
        product_id=item["product_id"],
        name=item["name"],
        sizes=sizes,
        total_quantity=sum(s.quantity for s in sizes),
        in_stock_sizes=[s.size for s in sizes if s.in_stock],
        out_of_stock_sizes=[s.size for s in sizes if not s.in_stock],
    )
    if requested is not None:
        entry = by_size.get(requested)
        result.requested_size = requested
        result.requested_size_quantity = entry.quantity if entry else 0
        result.requested_size_in_stock = bool(entry and entry.in_stock)

    # Unmet demand (Problem 9): the shopper asked for a size that's at 0, or for a product
    # that's sold out in every size. Counted once per (product, size) per chat request.
    if requested is not None and not result.requested_size_in_stock:
        _record_demand(ctx, item["product_id"], requested)
    elif requested is None and result.total_quantity == 0:
        _record_demand(ctx, item["product_id"], None)
    return result


def _record_demand(ctx: RunContext[ShopDeps], product_id: str, size: str | None) -> None:
    key = (product_id, size)
    if key in ctx.deps.recorded_demand:
        return
    ctx.deps.recorded_demand.add(key)
    user_id = ctx.deps.customer.user_id if ctx.deps.customer else None
    try:
        db.record_demand(product_id, size, user_id)
        log.info("demand recorded: %s size=%s (%s)", product_id, size or "-", "user" if user_id else "guest")
    except Exception:
        log.exception("could not record demand")  # never break the chat over analytics


def find_alternatives(product_id: str, size: str | None = None, max_results: int = 3) -> Alternatives | LookupProblem:
    """Find in-stock alternatives to a product the shopper can't get (or a size that's sold out).

    Returns up to 3 products of the same kind of garment (hoodie → hoodies, quarter-zip →
    quarter-zips...) that are in stock in the requested size, ranked by shared themes
    (sport, college, brand, design) and colours. Every alternative is a DIFFERENT product.
    An empty list means there is no reasonable in-stock alternative.

    Args:
        product_id: The product the shopper wanted (exact product_id).
        size: The size they need, e.g. "XL". Leave empty if no size was asked.
        max_results: How many alternatives to return (1-3).
    """
    requested = None
    if size is not None and size.strip():
        requested = _normalise_size(size)
        if requested is None:
            return LookupProblem(problem=f"'{size}' is not a size we carry.", valid_sizes=list(db.SIZE_ORDER))
    found = db.find_alternatives(product_id.strip(), requested, limit=max(1, min(max_results, 3)))
    if found is None:
        return _not_found(product_id)
    alternatives = [
        AlternativeProduct(
            product_id=a["product_id"],
            name=a["name"],
            garment_type=a["garment_type"],
            price_usd=a["price"],
            available_quantity=a["available_quantity"],
            shared_themes=a["shared_themes"],
            shared_colors=a["shared_colors"],
        )
        for a in found["alternatives"]
    ]
    note = None
    if not alternatives:
        note = "No in-stock alternatives of the same kind. Say so plainly; don't suggest unrelated items."
    return Alternatives(
        for_product_id=found["reference"]["product_id"],
        for_product_name=found["reference"]["name"],
        size=requested,
        alternatives=alternatives,
        note=note,
    )


TOOLS: list[Callable[..., Any]] = [
    find_products,
    get_product_info,
    get_product_price,
    get_product_stock,
    find_alternatives,
]
