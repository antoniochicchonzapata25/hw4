# Campus Customs: Usability Improvements (Problem 9)

Four improvements were added on top of the working storefront and chatbot: two on the front end and two in the agent and backend. Each one reuses the existing search, stock tools, product cards and detail pages instead of adding a parallel system.

---

## Front end

### 1. Product search and category filters (Products page)

**What was added**
- A search box on the Products page that updates the product cards as you type, after a short pause.
  - **Example searches:** "hoodies", "navy quarter zip", "hockey", "Branford" or "the game".
  - **Shared search:** it uses the **same catalogue search as the chatbot** (`GET /api/products?q=…` → `db.search_catalogue`), so the site and the assistant always agree on what matches.
- Quick filter buttons: All, Hoodies, Crewnecks, T-shirts, Quarter-zips, Jackets & fleece.
- A result count ("5 results for 'hockey'"), plus a clear "No products match" message with a **Show all products** button.
- The search is kept in the address bar (`/products?q=hockey`), so Back returns to the same results and searches can be shared.
- It works on phones: a full-width search box, wrapping filter buttons, and the 2-column card grid.

**Why it helps**
- **Fast browsing:** with 102 products, shoppers can find what they want in seconds without opening the chat.
- **Every label variant counts:** because the search understands categories ("hoodies" finds all 27 hooded items across 5 different labels), shoppers don't miss products just because the catalogue labels aren't standardised.

### 2. Shopping bag

**What was added**
- On every product page there's now a **size picker**, a **quantity stepper** and **Add to bag**.
  - **Sold-out sizes:** they're shown but disabled.
  - **Quantity cap:** it stops at the stock for that size, minus what's already in the bag.
  - **Confirmation:** "Added 2 × size XL to your bag. View bag".
- A **Bag** link with an item count in the top bar.
- A **bag page** (`/bag`) listing each item with its image, name, size, unit price, a quantity stepper, Remove, the line total, the **item count** and the **subtotal**, plus Continue shopping.
- **Live prices and stock:** prices and stock always come from the database (`POST /api/bag/quote`). If stock drops, the bag shows "Only N left" or "now out of stock", and that line is left out of the subtotal.
- **Works for everyone:**
  - It works for guests and logged-in shoppers, with one bag per account in the browser.
  - A guest bag moves into the account bag on login.
  - Logging out shows an empty guest bag, so a shared computer never shows someone else's bag.
- **Clearly not a checkout.** A notice says it's a shopping list, that no order has been placed and nothing has been charged or reserved, and to visit 57 Broadway to buy. There is no checkout or payment button, and the assistant is told never to claim a purchase.

**Why it helps**
- **Planning a visit:** shoppers can build a list (sizes for the whole family, gifts) and see the total before they come in.
- **Feels like a real store:** it makes the storefront feel complete, while being honest that online ordering isn't available yet.

---

## Agent and backend

### 3. Out-of-stock demand tracking (manager insight)

**What was added**
- A new `demand_events` table that records an event when a shopper **genuinely asks for something that's unavailable**:
  - a specific size with 0 stock ("Do you have the Champion Reverse Weave Hoodie in XL?"), or
  - a product sold out in every size.
- **What each event stores:** product id, size, timestamp, `source` ("chat"), and the user id **only if logged in** (guests are anonymous).
- **Recorded automatically** inside the existing `get_product_stock` tool, from the real stock result.
  - **Not recorded** when a product is merely described ("Tell me about…"), when browsing ("any hoodies?"), or when the size is in stock.
  - **No false records from alternatives:** alternatives are checked by a separate tool, so they never create demand.
  - **One count per question:** each (product, size) is counted at most once per chat message.
- **Manager report:** `GET /api/manager/demand`, protected by an `X-Manager-Key` header that must match `MANAGER_API_KEY`.
  - **What it lists:** each product and size requested while unavailable, the number of requests, how many distinct logged-in shoppers and how many guest requests, first and last request times, and **current stock**.
  - **What it leaves out:** no names or emails.

**How it helps Campus Customs understand unmet demand**
- **Lost sales become visible.** Today a shopper who can't find their size just leaves. Now each "sorry, it's sold out" becomes a data point.
- **Better restock decisions.** The manager can see which items and sizes to restock first ("Champion Reverse Weave Hoodie XL: 12 requests this month, still 0 in stock"), spot size patterns (XL and XXL selling out across hoodies), and judge whether a sold-out design is worth reordering.
- **Safe to use.** It needs no extra work from shoppers, and it shows counts, not identities.

### 4. Alternative recommendations when something is unavailable

**What was added**
- A new agent tool, `find_alternatives(product_id, size)`, that returns up to 3 **different** products of the **same kind of garment** (hoodie → hoodies, fleece → jackets and fleece) that are **in stock in the requested size**.
  - **Ranking:** by shared themes from the catalogue tags (brand, sport, college, design, such as "Champion" or "hockey"), then shared colours, then closeness in price.
  - **Stock checks:** it checks stock itself, so it never suggests a sold-out size.
- **Prompt rules:**
  1. Say clearly what's unavailable.
  2. Call `find_alternatives`.
  3. Recommend at most 3 options by name, as *similar but different* products.
  4. Show them as clickable cards.
  5. If nothing similar is in stock, just say so, never suggesting unrelated items.
  6. Don't offer alternatives when nothing is unavailable.

**How it improves the experience**
- **A next step instead of a dead end.** Instead of "sorry, XL is sold out", the shopper gets "XL is out, but these similar hoodies do come in XL", with cards they can click straight into.
- **Specific suggestions.** For example, the Champion Reverse Weave Hoodie in XL suggests the Champion Full Zip Hood (same brand, 8 in XL), and the Ice Hockey hoodie in L suggests the Yale Sports Hoodie Hockey.
- **Good for the shop:** it keeps the sale in the store and saves the shopper browsing time.
- **Honest:** alternatives come from the database, are never presented as the same item, and aren't forced when nothing fits.
