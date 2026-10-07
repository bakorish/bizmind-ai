# BizMind AI 🧠

**AI-powered Business Intelligence & Decision Support Platform for small online sellers.**

Implemented from the SRS *“BizMind_AI.pdf”* (University of Information Technology and Sciences — Software Project Design and Development Lab). Every functional requirement FR-01…FR-29, business rule BR-01…BR-07, non-functional requirement NFR-01…NFR-09 and AI feature listed in the SRS is implemented and tested.

> *“Existing systems tell business owners what happened. BizMind AI helps them understand why it happened, what may happen next, and what they can do about it.”* — SRS §33

---

## What's inside

| Layer | Stack | Location |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + Recharts | [`frontend/`](frontend/) |
| Backend API | Node.js + Express + Sequelize | [`backend/`](backend/) |
| Database | PostgreSQL (production) / SQLite (zero-config demo) | config via `DB_DIALECT` |
| AI/ML service | Python + FastAPI + XGBoost + scikit-learn + pandas | [`ai-service/`](ai-service/) |

```
User → React Web App → Node/Express REST API ─┬─→ PostgreSQL / SQLite (business data)
                                               └─→ Python FastAPI AI service ─→ XGBoost models
```

## Quick start (3 terminals)

```bash
# 1. AI service  (port 8001)
cd ai-service
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8001

# 2. Backend API  (port 5000)
cd backend
npm install
npm run seed        # demo business "GhorerBazaar BD" + 10 months of realistic order history
npm run dev

# 3. Frontend  (port 5173)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** and sign in:

### Easiest way on Windows (VS Code / Explorer)

Run **`.\start.bat`** from the VS Code terminal (PowerShell needs the `.\` prefix), or double-click it in Explorer — it opens all 3 services in separate windows and launches the browser. Use **`.\stop.bat`** to stop everything.

### Manual way (3 terminals in VS Code)

Open the `bizmind-ai` folder in VS Code (**File → Open Folder**), open the terminal (**Ctrl+`**), create 3 terminals (click **+**), and run one service in each:

```bat
:: Terminal 1 — AI service
cd ai-service && python -m uvicorn app.main:app --port 8001

:: Terminal 2 — backend API
cd backend && npm run dev

:: Terminal 3 — frontend
cd frontend && npm run dev
```

Then open http://localhost:5173. Press `Ctrl+C` in a terminal to stop that service.

| Account | Role | Password |
|---|---|---|
| `owner@bizmind.dev` | Business Owner (full access) | `password123` |
| `manager@bizmind.dev` | Manager (no financials) | `password123` |
| `staff@bizmind.dev` | Staff (orders only) | `password123` |
| `admin@bizmind.dev` | Platform Administrator | `password123` |

The seed generates a realistic Bangladeshi online fashion business — **1,640 orders** across 10 months with growth trend, weekly seasonality, Eid spikes, COD-heavy payments, product-dependent return rates and chronically-returning customers — enough history for every ML model to train on (BR-06).

### Database setup (PostgreSQL per SRS §27)

The project is **currently connected to PostgreSQL** on this machine:

```env
# backend/.env (active)
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bizmind
DB_USER=postgres
DB_PASS=bizmind123      # reset on 2026-10-08; change with ALTER USER if desired
```

Setup steps used (any machine):

```sql
-- connect as superuser, then:
CREATE DATABASE bizmind;
```

```bat
cd backend
npm run seed     :: creates all 17 tables + demo data in PostgreSQL
npm run dev
```

pgAdmin 18 (installed with PostgreSQL) can be used to browse the `bizmind` database — server: localhost:5432, user: postgres, password: bizmind123.

**Fallback:** SQLite needs no server at all. To switch back, restore `backend/.env.sqlite-backup` (or set `DB_DIALECT=sqlite` + `DB_STORAGE=./data/bizmind.sqlite`) — the previous SQLite database with its data is still in `backend/data/`.

## Feature coverage (SRS → implementation)

**Core business**
- FR-01/02/03 — Registration, JWT login, role-based access (owner / manager / staff / admin)
- FR-04 — Business profile (name, logo URL, currency ৳/$, settings)
- FR-05/06/07 — Product CRUD with **soft delete** (order history preserved) & SKU uniqueness
- FR-08/09/10 — Automatic stock tracking on confirm, **low-stock alerts → notifications**, full inventory movement ledger (initial/sold/restocked/returned/damaged)
- FR-11/12 — Customer registry + per-customer history (totals, completed/cancelled/returned, lifetime spend)
- FR-13/14/15 — Orders with server-computed totals, strict status lifecycle, search by order no / customer / phone / date / product / status
- FR-16/17 — Payment records incl. full COD tracking (order amount, delivery charge, collected, courier charge, return charge)
- FR-18/19 — Return recording (partial & full, resellable/damaged condition) and cancellation reasons
- FR-20/21/22/23 — Sales dashboard (daily/weekly/monthly), revenue from completed sales, **profit formula** (revenue − product cost − delivery − returns − discounts − expenses), product performance ranking
- FR-29 — Natural-language business assistant (see below)

**Business rules** — BR-01 delivered-requires-shipped ✅ · BR-02 stock never negative ✅ · BR-03 price edits restricted ✅ · BR-04 financial reports owner-only ✅ · BR-05 returns restock by condition ✅ · BR-06 predictions gated on data volume ✅ · BR-07 every prediction carries a disclaimer ✅

**AI/ML (Python microservice)**
- **FR-24 Sales forecasting** — XGBoost + Ridge blend on lag/rolling/calendar features (BD weekend seasonality), recursive multi-step prediction with 80% confidence band, 7/30/90-day horizons
- **FR-25 Demand prediction** — per-product 30-day demand with trend classification (increasing/stable/decreasing)
- **FR-26 Return/cancellation risk** — XGBoost classifiers on customer history (leak-free expanding-window features), payment method, order value, location; scores cached on open orders and surfaced in the order list
- **FR-27 Inventory recommendations** — safety-stock policy: cover = lead time + safety days + reorder buffer, driven by ML demand
- **FR-28 Automated insights** — month-over-month divergence detection (*“sales +18% but profit +4% because return & delivery costs rose”*), return/cancellation pressure, COD concentration, discount pressure, growth streaks
- **FR-29 AI assistant** — intent-matched NL Q&A grounded in live business data; answers every example question from the SRS (*“Why did my profit decrease this month?”*, *“Which product should I promote?”*, …)

**Non-functional** — bcrypt password hashing, JWT auth, helmet + rate limiting, input validation (express-validator + Sequelize), role-scoped data isolation, graceful AI-service unavailability (503), modular service architecture.

## Tests

```bash
cd backend && npm test          # 25 tests: profit formula, status workflow (BR-01),
                                # auth/RBAC (BR-04), stock rules (BR-02), full order lifecycle
cd ai-service && python -m pytest tests/ -q   # 21 tests: features, forecast bounds,
                                # risk ranges, recommender flags, intents, API contracts
```

## API overview (SRS §25.2)

```
POST /api/auth/register|login          GET  /api/auth/me
GET/POST /api/products                 PUT/DELETE /api/products/:id
GET/POST /api/categories               PUT/DELETE /api/categories/:id
GET /api/inventory                     GET /api/inventory/history
POST /api/inventory/adjust
GET/POST /api/customers                GET/PUT /api/customers/:id
GET/POST /api/orders                   GET/PUT /api/orders/:id
POST /api/orders/:id/returns
GET /api/returns                       GET /api/cancellations
GET /api/analytics/dashboard|sales|profit|products|series
GET/POST/DELETE /api/expenses
GET /api/ai/sales-forecast             GET /api/ai/demand-prediction
GET /api/ai/risk-prediction            GET /api/ai/recommendations
GET /api/ai/insights                   POST /api/ai/assistant
GET /api/notifications                 POST /api/notifications/read-all
GET/POST /api/users                    PUT /api/users/:id
GET/PUT /api/business
```

## Screens

Login · Register · **Dashboard** (KPIs, 30-day sales chart, AI insight banner, order pipeline, low-stock alerts, top products) · **Orders** (search/filter/paginate) · **Order detail** (status workflow, AI risk scoring, returns, COD panel) · New Order (POS-style) · **Products** · **Inventory** (overview + movement ledger) · **Customers** (+history drawer) · **Analytics** (trends, product performance, profit pie — owner only) · **AI Insights** (forecast/demand/risk/inventory tabs) · **AI Assistant** (chat) · **Settings** (profile, team, expenses)

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, data flow, model design
- [`docs/API.md`](docs/API.md) — endpoint reference
- [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md) — test levels per SRS §35

## Known limitations (SRS §37)

Predictions depend on historical data quality/quantity; no courier/Facebook/Instagram API integration in v1 (designed as future hooks — `Delivery`, `placedVia` fields already model them); financials are simplified vs. professional accounting.
