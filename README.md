# Campus Customs: Yale apparel shop + AI shopping assistant

Campus Customs is a Yale apparel and gift shop at 57 Broadway, New Haven. This project is its storefront:
- **Front end:** React + Vite + TypeScript.
- **Backend:** FastAPI, with a SQLite catalogue.
- **Shopping assistant:** **Dan**, a PydanticAI agent that answers from the real database.

MGT 409 · Homework 4.

## Features

- **Browse and search:** 102 products with photos. The Products page has search and category filters, and each product page has zoom, live stock per size, and a size and quantity picker.
- **Accounts:** create an account and log in. Passwords are hashed (PBKDF2-SHA256), and the session is an HttpOnly signed cookie.
- **Chat with Dan:**
  - live price and stock answers from the database
  - "What hoodies do you have?" shows clickable **product cards** in the chat and on the page
  - understands "this" on a product page
  - suggests in-stock **alternatives** when a size is sold out
- **Customer memory:** logged-in shoppers' chats are saved and restored. Guests can chat too, but nothing is saved.
- **Shopping bag:** a shopping list with live prices and a subtotal. It is **not** a checkout; no orders or payments happen.
- **Manager insight:** out-of-stock requests are logged and available as a demand report.
- **Audit trail:** every agent run's tool calls are appended to `output/audit_trail.json`.

## Tech stack

- **Backend:** Python 3.12+ · FastAPI · Uvicorn · PydanticAI · OpenAI client via the Portkey gateway (default model `gpt-5.6-luna`) · SQLite
- **Frontend:** Node 20+ · React 19 · Vite 8 · TypeScript · React Router

## Project structure

```
hw4/
├── AI_prompts.md            # prompts used with the coding assistant, per problem
├── README.md
├── requirements.txt         # backend Python packages
├── .env.example             # environment variables (placeholders)
├── .gitignore
├── backend/
│   ├── main.py              # FastAPI app (run with uvicorn)
│   ├── agent.py             # PydanticAI agent: model, prompt, run + audit
│   ├── models.py            # Pydantic request/response, tool-result and deps types
│   ├── tools.py             # agent tools: find_products, get_product_info/price/stock, find_alternatives
│   ├── prompts/prompt.md    # system prompt (Dan's voice, tool rules, safety)
│   ├── db.py                # SQLite access, search, cards, bag quote, demand
│   ├── auth.py              # password hashing + session tokens
│   └── audit.py             # append-only audit trail writer
├── frontend/                # React + Vite + TypeScript app (src/, public/)
└── output/
    ├── harness.md           # full technical description of the system
    ├── design.md            # visual design decisions
    ├── usability.md         # the four usability improvements
    ├── app_check.html       # testing report (open in a browser)
    ├── app_check_images/    # screenshots used by app_check.html
    └── audit_trail.json     # append-only agent audit log
```

## Local data pack (not in this repository)

The database and product photos are **not committed**. Get the course data pack and place it at:

```
hw4/data/campus_customs.db
hw4/data/products/*.jpg      # 102 images, referenced by the catalogue table
```

The backend finds `data/` relative to its own files, and serves only `data/products/`, never the `.db` file. On first start it adds one small table, `demand_events`, if it's missing. Nothing else in the database is changed.

## Environment variables

Copy `.env.example` to `.env` in `hw4/` and fill it in. Never commit `.env`.

| Variable | Needed for |
|---|---|
| `PORTKEY_API_KEY` | **Required** for the chatbot. Without it, the rest of the site works and chat returns a "not configured" message. |
| `OPENAI_MODEL`, `PORTKEY_BASE_URL` | Optional model settings (defaults: `gpt-5.6-luna`, `https://api.portkey.ai/v1`) |
| `SESSION_SECRET` | Recommended. Signs login cookies so logins survive a restart. |
| `MANAGER_API_KEY` | Optional. Enables `GET /api/manager/demand` (send it in the `X-Manager-Key` header). |

## Run it

**1. Backend** (from `hw4/`):

```bash
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd backend
uvicorn main:app --reload --port 8000
```

Check it with http://127.0.0.1:8000/api/health.

**2. Frontend** (from `hw4/frontend/`, in a second terminal):

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. Vite forwards `/api` and `/media` to the backend on port 8000.

A test account from the course data pack is described in the assignment, or you can create your own on the site.

## How it works (short version)

- **Authentication:**
  - Sign-up stores the name, a lowercase email and a PBKDF2-SHA256 hash (120,000 iterations, the same format as the seeded users).
  - Login sets an HttpOnly, SameSite=Lax cookie signed with HMAC, valid for 7 days.
  - The front end asks `/api/auth/me` who is logged in.
- **Chatbot:**
  1. The chat widget sends `POST /api/chat` with the message and the product page you're on.
  2. FastAPI works out who you are from the cookie, validates the product page, and runs the PydanticAI agent.
  3. The agent calls database tools for every product fact and returns a reply plus product ids.
  4. The server builds the product cards from the database, saves the exchange for logged-in users, and appends the tool calls to the audit trail.

See `output/harness.md` for the full technical details: models, tools, safety rules, limits and routes.
