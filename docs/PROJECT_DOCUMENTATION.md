# BizMind AI — Complete Project Documentation

**AI-powered Business Intelligence & Decision Support Platform for Small Online Sellers**

| | |
|---|---|
| **Institution** | University of Information Technology and Sciences (UITS), Dept. of CSE |
| **Course** | Software Project Design and Development Lab |
| **Team** | Md. Abu Bakor (7C1, 0432320005101156), Sadia Islam (7C2, 0432320005101206), Naziur Rahman Raju (7C1, 0432320005101157) |
| **Source requirement** | SRS "BizMind_AI.pdf" — every FR-01…FR-29, BR-01…BR-07, NFR-01…NFR-09 implemented |
| **Location** | `D:\bizmind-ai` |

> This document explains the project A→Z: **what** each part does, **where** it lives (file-by-file), **why** every design decision was made, and **how** it works internally.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack and Why Each Was Chosen](#2-technology-stack-and-why-each-was-chosen)
3. [System Architecture](#3-system-architecture)
4. [Database Design](#4-database-design)
5. [Backend Walkthrough (file-by-file)](#5-backend-walkthrough-file-by-file)
6. [AI/ML Service Walkthrough](#6-aiml-service-walkthrough)
7. [Frontend Walkthrough (page-by-page)](#7-frontend-walkthrough-page-by-page)
8. [Business Rules — Where and How Enforced](#8-business-rules--where-and-how-enforced)
9. [Security Implementation](#9-security-implementation)
10. [Testing](#10-testing)
11. [Demo Data (Seed) Design](#11-demo-data-seed-design)
12. [How to Run](#12-how-to-run)
13. [Complete File Map](#13-complete-file-map)
14. [Key Design Decisions — The "Why" List](#14-key-design-decisions--the-why-list)
15. [Limitations and Future Enhancements](#15-limitations-and-future-enhancements)

---

## 1. Project Overview

### 1.1 The Problem (SRS §4)

Small online sellers in Bangladesh run their business across Facebook/Instagram messages, spreadsheets, notebooks, phone calls and courier dashboards. This causes:

- **Data fragmentation** — business information scattered across tools, no single view
- **Manual record keeping** — orders, inventory, payments updated by hand
- **No business intelligence** — tools show *what* happened, never *why*
- **Poor demand planning** — no idea how much stock to buy next month
- **COD losses** — cancellations and returns eat profit unpredictably

### 1.2 The Solution

BizMind AI is a web platform that **records** business operations (products, inventory, customers, orders, payments, returns) and then **analyzes** them with machine learning to produce:

| Capability | SRS Feature | What the user actually gets |
|---|---|---|
| Sales dashboard | FR-20–23 | Daily/weekly/monthly sales, order pipeline, product ranking |
| Profit analysis | FR-22 | Revenue − product cost − delivery − returns − discounts − expenses |
| Sales forecasting | FR-24 | "Next 30 days: ~330 units (range 278–378)" with a daily curve |
| Demand prediction | FR-25 | Per-product 30-day demand + trend arrow |
| Order risk scoring | FR-26 | "Order BM-1042: 78% cancellation risk — call before dispatch" |
| Inventory advice | FR-27 | "Three-Piece (Red): 0.8 days cover left → buy 67 units" |
| Auto insights | FR-28 | "Sales grew 18% but profit only 4% because return costs rose" |
| AI assistant | FR-29 | Ask "Why did my profit decrease?" → answer from your real data |

> **The core promise (SRS §33):** *Existing systems tell business owners what happened. BizMind AI helps them understand why it happened, what may happen next, and what they can do about it.*

### 1.3 User Roles (SRS §7)

| Role | Can do | Cannot do |
|---|---|---|
| **Owner** | Everything: products, inventory, orders, customers, finance, analytics, AI, team management | — |
| **Manager** | Daily operations: orders, products, inventory, customers, analytics, AI | Financial reports (BR-04), settings, team management |
| **Staff** | Create/update orders, view products, basic inventory | Financials, analytics, AI, prices |
| **Admin** | Platform-wide administration | — (platform account, not tied to one business) |

### 1.4 Roles in the demo

| Login | Password | Role |
|---|---|---|
| `owner@bizmind.dev` | `password123` | Owner — Md. Abu Bakor |
| `manager@bizmind.dev` | `password123` | Manager — Sadia Islam |
| `staff@bizmind.dev` | `password123` | Staff — Naziur Rahman Raju |
| `admin@bizmind.dev` | `password123` | Platform admin |

---

## 2. Technology Stack and Why Each Was Chosen

| Layer | Technology | Why this and not alternatives |
|---|---|---|
| Frontend | **React 18** | Component model fits a dashboard-heavy app (same card/table/chart patterns reused everywhere); largest ecosystem; SRS specifies React |
| Build tool | **Vite 5** | Instant dev server, native ESM; Create-React-App is deprecated and slow |
| Styling | **Tailwind CSS 3** | Utility classes keep styling inside components (no separate CSS files to drift); consistent design tokens; fast to iterate |
| Charts | **Recharts** | Built for React (declarative SVG charts); lighter than Chart.js wrappers |
| Icons | **lucide-react** | Tree-shakeable SVG icons, uniform stroke style |
| Backend | **Node.js + Express 4** | Same language across frontend/backend (one team, one mental model); Express is minimal and explicit — routing/middleware are easy to explain in a viva |
| ORM | **Sequelize 6** | Write models once, run on **both PostgreSQL and SQLite** (dialect switch) — this gave the project a zero-config demo mode *and* the SRS-required production DB |
| Database | **PostgreSQL 18** (production) / **SQLite** (demo) | PostgreSQL = SRS §27 requirement, real client-server RDBMS, ACID guarantees. SQLite = zero-install fallback so the project runs on any machine in seconds |
| AI service | **Python 3.12 + FastAPI** | Python owns the ML ecosystem (pandas, sklearn, XGBoost); FastAPI is async, fast, auto-generates docs, and validates payloads with Pydantic |
| ML | **XGBoost 3.4** (+ scikit-learn fallback, Ridge blend) | XGBoost = industry standard for tabular data (SRS names it). A pure-sklearn fallback keeps the service runnable if XGBoost can't install; Ridge smooths GBM noise in forecasts |
| Auth | **JWT (jsonwebtoken) + bcryptjs** | Stateless tokens suit a REST API (no server session store); bcrypt is the SRS-named hashing algorithm; `bcryptjs` is the same algorithm in pure JS (no native build issues on Windows) |
| Testing | **Jest + supertest** (backend), **pytest + TestClient** (AI) | Jest integrates with npm scripts; supertest exercises the real Express app including middleware; FastAPI's TestClient tests endpoints in-process |
| Hardening | **helmet, express-rate-limit** | Standard HTTP security headers and auth-endpoint throttling with two lines of code (NFR-05) |

---

## 3. System Architecture

### 3.1 The three-service layout (SRS §26 "layered architecture")

```
┌────────────────────────────────────────────────────────────┐
│  PRESENTATION — React 18 + Vite + Tailwind + Recharts      │
│  http://localhost:5173                                     │
│  AuthContext · Layout · 13 pages                           │
└──────────────────────────┬─────────────────────────────────┘
                           │ REST/JSON + JWT Bearer token
┌──────────────────────────▼─────────────────────────────────┐
│  APPLICATION — Node.js + Express                            │
│  http://localhost:5000/api                                  │
│  routes → auth/RBAC middleware → controllers → services     │
└───────────┬────────────────────────────────┬───────────────┘
            │ Sequelize ORM                   │ HTTP POST (data bundle)
┌───────────▼──────────────┐   ┌──────────────▼───────────────┐
│  DATA — PostgreSQL        │   │  AI/ML — Python FastAPI      │
│  (or SQLite for demo)     │   │  http://localhost:8001       │
│  17 entities              │   │  XGBoost + sklearn + pandas  │
└───────────────────────────┘   └──────────────────────────────┘
```

### 3.2 Why the AI part is a separate service (microservice)

1. **The SRS demands it** (§2.1, §26: "Python AI/ML Service" as its own layer)
2. **Different runtimes** — XGBoost/pandas exist only in Python; the rest of the app is JS. Processes must be separate
3. **Independent lifecycle** — ML code can be retrained/redeployed without touching the business API (NFR-06 maintainability)
4. **Graceful degradation** — if the AI service is down, the backend returns a clean `503 "AI service is unavailable"` for `/api/ai/*` while **all business operations keep working** (orders, inventory, payments are unaffected)

### 3.3 The "data bundle" pattern — how backend and AI talk

Instead of the AI service connecting to the database directly (which would duplicate ORM models in Python and create a second source of truth), the backend **builds one complete JSON snapshot** of the business and POSTs it with each AI request:

```
GET /api/ai/sales-forecast
  → backend builds bundle: all orders + items + payments + returns
    + products + current stock + customers + monthly/daily series + profit metrics
  → POST http://localhost:8001/api/forecast/sales  { bundle, horizon_days: 30 }
  → AI service trains (or reuses cached models), predicts, returns JSON
  → backend logs the prediction (AI_Predictions table) and returns it
```

**Why this design:**
- AI models receive *exactly* the data the business is authorized to see (29.4 data protection stays in one place)
- The AI service is **stateless** — no DB credentials, no second ORM, trivially testable (the pytest suite builds synthetic bundles)
- Every AI result is **auditable**: each call is recorded in `AIPredictions` with its payload and model info

### 3.4 Model caching (BR-06 in practice)

Training XGBoost on 1,600+ orders takes a few seconds — doing it on *every* request would make the UI feel slow. The AI service keeps a per-business **in-memory model cache** keyed by:

- **fingerprint** = SHA of (order count + last order ID + business ID) → data changed → retrain
- **TTL** = 10 minutes → periodic refresh even if fingerprint logic misses something

```python
STORE.get(business_id, bundle, kind, trainer)   # returns cached model or trains new
```

### 3.5 AI minimum-data gates (BR-06: "predictions only when sufficient historical data")

| Feature | Minimum required | Response when insufficient |
|---|---|---|
| Sales forecast | 14 days of completed sales | `{sufficientData: false, reason: "..."} `— UI shows a friendly notice, never fake numbers |
| Demand prediction | 40 product-day sales rows | same pattern |
| Risk prediction | 120 historical orders | same pattern |
| Every AI response | — | carries `disclaimer` field (BR-07: estimates, not guarantees) |

---

## 4. Database Design

### 4.1 Entity list (17 tables — SRS §28)

```
Business ─┬─ Users                    (owner/manager/staff belong to a business)
          ├─ Categories ─ Products ─ Inventory ─ InventoryTransactions
          ├─ Customers ─ Orders ─ OrderItems
          │                 ├─ Payments        (one row per order; COD detail)
          │                 ├─ ReturnRecords   (partial or full returns)
          │                 ├─ Cancellations   (one row, with reason)
          │                 └─ Deliveries      (courier, tracking, charges)
          ├─ Expenses               (marketing/rent/transport → profit formula)
          ├─ AIPredictions          (log of every AI result served)
          ├─ AIRecommendations      (actionable restock suggestions)
          └─ Notifications          (low-stock alerts, system events)
```

### 4.2 Table-by-table purpose and key fields

| Table | Purpose | Fields worth knowing | Why |
|---|---|---|---|
| **Businesses** | Tenant root | `currency` (BDT default), `settings` JSON (`safetyStockDays`, `defaultLeadTimeDays`) | Settings as JSON lets inventory policy change without migrations |
| **Users** | Accounts | `businessId` (NULL = platform admin), `role` enum, `isActive` | Soft-disable instead of delete keeps order history intact |
| **Categories / Products** | Catalog | `sellingPrice`, `costPrice`, `reorderLevel`, `leadTimeDays`, `isActive` | `isActive=false` is **soft delete** (FR-07) — historical orders keep pointing at the product |
| **Inventory** | Current stock (1 row per product) | `currentStock` with `min: 0` validation | DB-level guarantee that stock is never negative (BR-02 backstop) |
| **InventoryTransactions** | Full movement ledger (FR-10) | `type` (initial/sold/restock/returned/damaged/adjustment), signed `quantity`, `balanceAfter`, `referenceType/referenceId` | `balanceAfter` makes every row self-verifying; references link back to the order/return that caused it |
| **Customers** | Buyers | `phone` unique per business | Phone is the real-world identity in BD e-commerce |
| **Orders** | The heart | `status` enum (8 states), `orderNo` (`BM-2026-00001`), money fields, `paymentMethod`, `placedVia`, `riskScore`/`riskLevel` | `placedVia` models Facebook/Instagram/website sources (future integration hook); risk score cached from the AI so order lists can flag risk without re-scoring |
| **OrderItems** | Line items | `productName`, `unitPrice`, **`unitCost`** snapshots | **Snapshot design**: price/cost are frozen at order time. If the owner changes a product's price later, historical profit never changes — analytics stay stable |
| **Payments** | Money tracking (FR-16/17) | `method`, `status`, COD columns: `collectedAmount`, `courierCharge`, `returnCharge` | COD economics (courier charge, return penalty) directly feed the profit formula |
| **ReturnRecords** | Returns (FR-18) | `quantity`, `reason`, `condition` (resellable/damaged), `refundStatus` | Condition decides restocking (BR-05): resellable → back to stock; damaged → cost is lost |
| **Cancellations** | Cancel reasons (FR-19) | `reason` enum (6 SRS reasons), `stage` (where in pipeline it died) | Stage tells you whether stock was already deducted |
| **Deliveries** | Shipment tracking | `courierName`, `trackingCode`, charges, timestamps | Models real BD couriers (Steadfast/Pathao/RedX); ready for future courier API sync |
| **Expenses** | Overhead | `category` enum, `amount`, `expenseDate` | Feeds the last term of the FR-22 profit formula |
| **AIPredictions** | AI audit log | `type`, `payload`, `modelInfo` | Proves what the AI said and when (nice for viva) |
| **AIRecommendations** | Actionable advice | `type` (restock/…), `detail` JSON, `priority`, `status` (new/viewed/applied) | Restock advice becomes a trackable to-do list |
| **Notifications** | Alerts | `type` (low_stock/order/ai_insight/system), `isRead` | FR-09 low-stock alerts land here; bell icon polls them |

### 4.3 Why there is no "Sales" table (SRS lists it as an entity)

Sales figures are **derived aggregates** computed from delivered orders (`analyticsService.dailySeries/monthlySeries/salesSummary`). A separate Sales table would be a *second source of truth* — every order status change would need to update it too, and any drift would silently corrupt analytics. Deriving on the fly is always consistent; at demo scale (thousands of orders) it's instant. This decision is documented in `docs/ARCHITECTURE.md`.

### 4.4 Multi-tenancy and data isolation (29.4)

Every business entity carries `businessId`. Every query in controllers/services filters by it (`where: { businessId: req.user.businessId }`). A staff member of business A **cannot** read business B's rows even by guessing IDs — the ID is looked up *within the scope*, not globally. Platform admins (`role=admin`, `businessId=null`) are the only exception.

### 4.5 PostgreSQL vs SQLite — the dialect switch

One file (`backend/src/config/database.js`) reads `DB_DIALECT`:

```env
# production / real DB (current setting on the dev machine)
DB_DIALECT=postgres
DB_HOST=localhost  DB_PORT=5432  DB_NAME=bizmind  DB_USER=postgres  DB_PASS=*****

# zero-config demo mode (what the shared zip uses)
DB_DIALECT=sqlite
DB_STORAGE=./data/bizmind.sqlite
```

All 17 models are written in dialect-neutral Sequelize — `sequelize.sync()` creates the schema on either engine. Switching is a one-line `.env` change (both configs are kept: `.env`, `.env.sqlite-backup`, `.env.example`).

---

## 5. Backend Walkthrough (file-by-file)

Location: `D:\bizmind-ai\backend\` · Entry: `src/server.js` · ~60 REST endpoints

```
backend/
├── src/
│   ├── server.js          ← boots DB + Express
│   ├── app.js             ← Express app (helmet/cors/json/routes/errors)
│   ├── config/            ← env.js, database.js
│   ├── models/            ← 17 Sequelize entities + associations
│   ├── middleware/        ← auth (JWT+RBAC), errorHandler (+validate)
│   ├── services/          ← BUSINESS LOGIC lives here (the brain)
│   ├── controllers/       ← thin HTTP layer (parse → call service → respond)
│   ├── routes/index.js    ← URL → controller + permission wiring
│   ├── utils/profit.js    ← FR-22 formula as pure functions
│   └── seed/seed.js       ← 10-month demo history generator
└── tests/                 ← 3 Jest suites (25 tests)
```

### 5.1 `src/server.js` and `src/app.js` — startup

- `server.js`: ensures the SQLite data folder exists → `sequelize.authenticate()` → `sequelize.sync()` (auto-creates/updates tables; chosen over migrations because this is an academic project — production would use migration files) → `app.listen(PORT)`.
- `app.js`: security middleware chain — **helmet** (HTTP security headers), **cors** (dev: any origin), **express.json({limit:'2mb'})** (the AI bundle is large but bounded), then `/api` routes, then 404 handler and the central error handler.

### 5.2 `src/config/env.js` — environment with a safety check

Reads `.env` once; **fails loudly in production if JWT_SECRET is still the default** (NFR-05 — a known secret would let anyone forge tokens).

### 5.3 `src/models/` — entities and their validation rules

| File | Contains | Notable validations/decisions |
|---|---|---|
| `business.js` | Business | `settings` JSON with defaults (`safetyStockDays:5`, `defaultLeadTimeDays:7`) used by the AI recommender |
| `user.js` | User | email `isEmail` validation; `toPublicJSON()` strips `passwordHash` from every response (NFR-05: hash never leaves the server) |
| `catalog.js` | Category + Product | prices `min:0`; `isActive` soft-delete flag; `leadTimeDays` per product feeds AI restock advice |
| `customer.js` | Customer | custom `isEmailOrNull` validator — optional but, if present, must be valid (NFR-07) |
| `order.js` | Order + OrderItem + **`STATUS_TRANSITIONS` map** | The single source of truth for the lifecycle (BR-01) — also imported by the workflow unit test |
| `inventory.js` | Inventory + InventoryTransaction | `currentStock min:0`; ledger types enum |
| `fulfillment.js` | Payment, ReturnRecord, Cancellation (+6 SRS cancel reasons), Delivery | COD fields; return `condition` enum; refund status |
| `intel.js` | Expense, AIPrediction, AIRecommendation, Notification | AI audit + advice + alerts |
| `index.js` | All associations (Business→Users/Products/Customers/Orders→Items/Payments/Returns…) | `Order.hasMany(OrderItem, as:'items')` alias used everywhere |

### 5.4 `src/middleware/auth.js` — authentication + RBAC (FR-03, 29.3, BR-04)

Three exported pieces:

1. **`authenticate`** — reads `Authorization: Bearer <jwt>`, verifies signature/expiry with `jwt.verify`, loads the user, rejects disabled accounts. Mounted on every protected route.
2. **`requirePermission(p)`** — the **permission matrix**:

```js
const ROLE_PERMISSIONS = {
  owner:  ['products','inventory','orders','customers','finance','analytics','ai','users','settings'],
  manager:['products','inventory','orders','customers','analytics','ai'],        // no finance/users/settings
  staff:  ['orders','customers','products','inventory'],                        // no analytics/ai/finance
  admin:  [... everything ..., 'platform'],
};
```

3. **`requireFinanceAccess`** — extra guard on money endpoints (`/analytics/profit`, `/expenses`) because BR-04 says *only owner/admin may open financial reports*. Tested from both sides (staff→403, owner→200).

**Why a permission matrix instead of checking `role==='staff'` everywhere:** one table explains the whole policy — easy to show in a viva, easy to test, one place to change.

### 5.5 `src/middleware/errorHandler.js` — one error format

`ApiError(status,message)` class + central handler that maps Sequelize validation/unique errors → `400` with field messages (29.5), hides stack traces in production, plus the `validate` helper that turns express-validator results into `400 {errors:[{field,message}]}`.

### 5.6 `src/services/orderService.js` — the order brain (FR-13/14/15, BR-01/02/05)

**`createOrder`** — *why totals are computed server-side:* the client sends only `{customerId, items:[{productId, quantity}], ...}`; prices come from the **catalog** and are snapshotted onto `OrderItems` (`unitPrice` + `unitCost`). A tampered client can never invent a price, and profit history is stable forever. Everything runs in **one Sequelize transaction** — order + items + payment shell + optional delivery row are created atomically.

**`STATUS_TRANSITIONS` + `assertTransition` (BR-01)** — the lifecycle is a strict map, not if-else soup:

```
pending → confirmed → processing → shipped → out_for_delivery → delivered → returned
   └────────────┴────────────┘ (cancelled allowed only BEFORE shipping)
```

`updateStatus` enforces the map, then applies **side effects per transition**:

| Transition | Side effect |
|---|---|
| → confirmed | stock deducted per item (`applyStockChange`), low-stock check (FR-08/09) |
| → cancelled | if stock was already deducted (confirmed/processing) it is **restored**; a `Cancellation` row records the reason + stage (FR-19) |
| → shipped / out_for_delivery | `Delivery` row updated, timestamps set |
| → delivered | payment marked `paid`, COD `collectedAmount` recorded, `deliveredAt` set (FR-16/17) |

**Stock policy — when is stock deducted?** On *confirm*, not on order creation. Rationale: many BD sellers keep orders in "pending" while confirming via phone; deducting at pending would show phantom stock-outs. BR-02 is enforced inside `applyStockChange` (throws `400 Insufficient stock` if the movement would go below zero).

**`recordReturn` (FR-18, BR-05)** — validates returned quantity ≤ purchased quantity (cumulative check across multiple returns), creates `ReturnRecord`s, then: **resellable → units go back to stock; damaged → not restocked and the loss is visible in profit**. If *all* units of the order are returned, the order flips to `returned` and the payment to `refunded`.

**`searchOrders` (FR-15)** — one endpoint searching by order-no, customer name/phone (LIKE), date range, status, product (via OrderItem join) or customer, with pagination.

**`customerHistory` (FR-12)** — total/completed/cancelled/returned orders, lifetime spend, cancellation rate → also feeds the customer "risk" badge in the UI and the AI risk model.

### 5.7 `src/services/inventoryService.js` — stock engine (FR-08/09/10, BR-02)

- **`applyStockChange`** — the *only* function allowed to change stock. It finds-or-creates the `Inventory` row, computes the new balance, **throws if it would go negative** (BR-02), writes the ledger row with `balanceAfter`, all inside the caller's transaction. Having one choke-point means no code path can bypass the rules.
- **`checkLowStock`** — after any deduction, if stock ≤ reorder level it creates a `Notification` ("Black T-Shirt — only 5 pcs remaining") — deduplicated so the bell doesn't spam one alert per order (FR-09).
- **`getInventoryOverview`** — stock, status (ok/low/out_of_stock), stock value, days-of-cover inputs per product.

### 5.8 `src/utils/profit.js` — the FR-22 formula, pure and tested

```js
Profit = Revenue − Product Cost − Delivery Cost − Return Cost − Discounts − Other Expenses
```

Implemented as **pure functions** (`computeProfit`, `orderRevenue`) with no DB access — that's exactly what makes them directly unit-testable (SRS §35 names "profit calculation" as a unit-test target). Damage-aware: a damaged return adds its product cost to `returnCost` because those units can't be resold. Discounts are already netted inside `orderRevenue` (revenue = subtotal − discount, floored at 0).

### 5.9 `src/services/analyticsService.js` — analytics engine (FR-20/21/22/23)

- **`salesSummary(period)`** — counts by status, revenue from *delivered* orders only (FR-21), average order value, and % change vs the equivalent previous period (uses period math helpers: today/week/month/quarter/year/`last_N_days`/all).
- **`profitAnalysis(period)`** — loads delivered orders + items + payments, return records with their item value/cost, and expenses; calls `computeProfit`; also computes the *prior period* profit for change %.
- **`dailySeries(30)` / `monthlySeries(12)`** — chart series (orders, units, revenue per day/month). These also become features for the AI models.
- **`productPerformance(period)`** (FR-23) — per product: units, revenue, profit, **return rate**, **cancellation rate** → the "Product Performance" table and declining-product detection.
- **`dashboard()`** — one parallel call assembling everything the landing page needs (today/week/month summaries, profit, 30-day series, top 5 products, low stock) → a single HTTP round-trip for the dashboard.

### 5.10 `src/services/aiGateway.js` — the bridge to Python (FR-24…29)

- **`buildDataBundle(businessId)`** — assembles the full business snapshot (orders with items/payments/returns/cancellations, products+stock, customers, monthly/daily series, profit metrics, settings) — described in §3.3.
- One function per AI feature: `salesForecast`, `demandPrediction`, `riskPrediction`, `inventoryRecommendations`, `businessInsights`, `assistantAsk`. Each: build bundle → POST to the Python service → **log to `AIPredictions`** → return.
- `riskPrediction` additionally **caches scores on open Orders** (`riskScore`, `riskLevel`) so the order list shows risk chips without re-running the model.
- `inventoryRecommendations` persists "reorder" advice into `AIRecommendations` (a to-do list the UI can mark viewed/applied).
- **Connection errors are translated** (`ECONNREFUSED` → `503 "AI service is unavailable"`), so a stopped Python service never crashes the API (graceful degradation, §3.2).

### 5.11 `src/routes/index.js` — the endpoint map (SRS §25.2)

Every route = middleware chain `authenticate → requirePermission → controller`. Auth routes additionally get an **express-rate-limit** (50 requests / 15 min) to slow brute-force attempts. The full endpoint table is in [`docs/API.md`](API.md). Highlights:

```
POST /api/auth/register|login     GET /api/auth/me
CRUD /api/products, /api/categories
GET  /api/inventory, /api/inventory/history      POST /api/inventory/adjust
GET/POST /api/customers/:id?                     (history stats included)
GET/POST/PUT /api/orders/:id                     POST /api/orders/:id/returns
GET  /api/analytics/dashboard|sales|products|series
GET  /api/analytics/profit        ← requireFinanceAccess (BR-04)
GET  /api/ai/sales-forecast|demand-prediction|risk-prediction|recommendations|insights
POST /api/ai/assistant            GET /api/notifications
GET/POST/PUT /api/users           (owner/admin only)
```

### 5.12 `src/seed/seed.js` — 10 months of realistic history

Detailed design in §11. Generates: business + 4 users, 5 categories, 18 BD-fashion products, 65 customers (~20% chronically-returning), **~1,650–1,680 orders** over 10 months with growth trend, Friday/Saturday peaks, two Eid-style spikes, 78% COD, product-dependent return rates, cancellations with SRS reasons, payments with courier charges, deliveries, monthly expenses — plus a block of **open orders in the last 5 days** so the risk-scoring demo has live material. Two products are deliberately left near-zero stock so FR-09 alerts and the restock recommendations always have something to show.

---

## 6. AI/ML Service Walkthrough

Location: `D:\bizmind-ai\ai-service\` · Python 3.12 · FastAPI on port 8001

```
ai-service/
├── app/
│   ├── main.py            ← FastAPI app + 6 POST endpoints
│   └── core/
│       ├── features.py    ← data bundle → pandas DataFrames + ML features
│       ├── models.py      ← SalesForecaster, DemandModel, RiskModel, ModelStore
│       ├── recommender.py ← inventory policy + insight generator (FR-27/28)
│       └── assistant.py   ← natural-language assistant (FR-29)
├── tests/test_ai.py       ← 21 pytest tests
└── requirements.txt
```

### 6.1 `core/features.py` — feature engineering (the honest part of ML)

- **`parse_date`** — normalizes the backend's ISO-UTC timestamps to timezone-naive datetimes (a real bug found during integration: pandas cannot compare tz-aware and naive values).
- **`orders_frame`** — one row per order with derived flags: `is_cod`, `high_value` (>৳2500), `is_dhaka`, `item_count`, `units`, `cancelled`, `returned`, `had_return`.
- **`daily_sales_frame`** — per (day, product) units/revenue from completed orders — the base for forecasting and demand.
- **`calendar_features`** — day-of-week, month, day-of-year, and **`is_bd_weekend`** (Fri/Sat — BD's shopping peak; Western models assume Sat/Sun).
- **`enrich_series_features`** — lags (1/2/3/7/14/30), rolling mean/std (7/14/30), expanding mean, pct-change: classic time-series features.
- **`customer_history_features`** — per-order customer aggregates (**cancel rate, return rate, order count, spend**) computed with an **expanding window shifted by one** — i.e., strictly from *prior* orders. This prevents **target leakage**: the model must not "know" the outcome of the very order it is scoring.

### 6.2 `core/models.py` — the three models

**`SalesForecaster` (FR-24)**
- Training: daily total-units series → lag/rolling/calendar features → **XGBoost regressor + Ridge regression**, blended 70/30 at prediction time. *Why the blend:* GBMs capture spikes/seasonality but can jitter day-to-day; Ridge stabilizes the level.
- Prediction: **recursive multi-step** — predict day 1, append it to history, recompute features, predict day 2… up to 7/30/90 days.
- Confidence band: residual standard deviation × 1.282 (≈80% interval) that **widens with horizon** (`√(1+step/14)`) — honest uncertainty growth.
- Minimum 14 days of history or it refuses (BR-06).

**`DemandModel` (FR-25)**
- Training rows: (day × product) with calendar + product features (price, margin, discount, product code). One XGBoost regressor for all products (product identity as a feature) — more training data per product than 18 tiny per-product models.
- Predicts next-30-day units per product; trend = recent 30-day velocity vs older baseline (>1.1× increasing, <0.9× decreasing).

**`RiskModel` (FR-26)**
- Two binary classifiers (XGBoost): **cancellation** and **return-or-had_return**, trained on historical outcomes.
- Features (12): COD flag, order total, high-value flag, item count, units, avg unit price, is-Dhaka, customer prior orders / **prior cancel rate** / **prior return rate** / prior spend, day-of-week.
- Scores every **open** order (pending→out_for_delivery): `cancellationRiskPct`, `returnRiskPct`, overall `riskLevel` (HIGH ≥60, MEDIUM ≥35).
- The pattern it learned (visible in the demo): high-value COD orders from customers who previously cancelled = high risk → UI recommends a confirmation call.

**`ModelStore`** — per-business cache keyed by data fingerprint + 10-min TTL (§3.4).

### 6.3 `core/recommender.py` — inventory + insights

**`recommend_inventory` (FR-27)** — safety-stock policy on top of ML demand:

```
cover_days      = lead_time + safety_days (business setting, default 5)
target_stock    = predicted_daily_demand × cover_days + reorder_level
recommended_buy = max(0, ceil(target_stock − current_stock))
action          = out_of_stock→reorder(high) · days_of_cover ≤ lead → reorder(high/medium)
                  ≤ lead+safety → reorder(medium) · >120 days → overstock · else monitor
```
Falls back to plain velocity when ML data is insufficient (`method: "velocity"` vs `"ml"` is returned for transparency).

**`generate_insights` (FR-28)** — six detectors comparing this month (MTD, **normalized to daily averages** so 7 elapsed days vs a full month compares fairly) against last month:
1. Sales vs **profit divergence** — the SRS flagship ("sales +18%, profit only +4% → return & delivery costs…")
2. Rising **return rate**
3. Rising **cancellation rate**
4. **COD concentration** (>70% → suggest prepaid incentives)
5. Rising **discount share**
6. 3-month **growth trend**

Each insight = title + detailed actionable sentence + severity (warning/positive/info) + data payload.

### 6.4 `core/assistant.py` — the NL assistant (FR-29)

**Why rule-based intent matching instead of calling an external LLM (e.g., ChatGPT):** the answers must be (a) **grounded in this business's real numbers**, (b) available **offline** during a viva demo with no API key/budget, and (c) **deterministic and auditable**. A keyword/regex intent matcher over 11 intents (best_sellers, worst_products, profit_question, stock_out, forecast, promote, returns, cancellations, customers, revenue_summary, risk_orders) selects a template that is filled with live-computed figures.

It answers all four SRS example questions, e.g.:

> **"Why did my profit decrease this month?"** →
> "This month: revenue ৳354,295, profit ৳141,417 (margin 39.9%, −27% vs previous period). Costs: product ৳190,560, delivery ৳10,665, returns ৳4,590… Main pressure points: delivery costs ৳10,665."

Every response includes `suggestedFollowups` (the chips under the chat) and the BR-07 disclaimer.

### 6.5 `app/main.py` — the API surface

`GET /health` (reports which model engine loaded — XGBoost or sklearn fallback), then six POST endpoints taking the data bundle: `/api/forecast/sales`, `/api/predict/demand`, `/api/predict/risk`, `/api/recommend/inventory`, `/api/insights`, `/api/assistant`. Pydantic models keep the bundle schema-loose (`extra: allow`) but validate request structure; every prediction response carries `disclaimer` (BR-07) and insufficient-data responses carry `sufficientData:false` + reason (BR-06).

---

## 7. Frontend Walkthrough (page-by-page)

Location: `D:\bizmind-ai\frontend\` · React 18 + Vite (dev port 5173, proxies `/api` → 5000)

```
frontend/src/
├── main.jsx / App.jsx        ← entry + routing
├── index.css                 ← Tailwind + Nirmala UI font (৳ glyph)
├── api/client.js             ← axios instance + interceptors
├── context/AuthContext.jsx   ← login/register/logout + permission helper
├── components/
│   ├── Layout.jsx            ← sidebar + topbar + notification bell
│   └── ui.jsx                ← Card, KpiCard, Badge, Modal, Spinner, Th/Td…
├── utils/format.js           ← money (৳, en-IN grouping), dates, status metadata
└── pages/                    ← 13 pages (below)
```

### 7.1 Infrastructure files

| File | What it does | Why it's built this way |
|---|---|---|
| `api/client.js` | Axios with baseURL `/api`; **request interceptor** attaches the JWT from localStorage; **response interceptor** catches 401 → clears session → redirects to /login | One place for auth plumbing; pages never touch tokens |
| `context/AuthContext.jsx` | Holds `user`+`business`, restores session on refresh via `GET /auth/me`, exposes `login/register/logout` and `can(permission)` — a mirror of the backend permission matrix | The sidebar and pages hide what a role can't use; the backend still re-checks (defense in depth) |
| `components/Layout.jsx` | Dark sidebar (nav items **filtered by `can()`**), topbar with business name, user chip + role badge, and the **notification bell** polling `/notifications` every 60s with unread count | One layout, role-aware, FR-09 alerts surface everywhere |
| `components/ui.jsx` | Small design system: KpiCard (with ▲/▼ change %), Badge, Modal (ESC-close), Spinner, EmptyState, table primitives, RiskChip | Consistent look without a UI library |
| `utils/format.js` | `money()` with ৳ and Indian-style digit grouping (৳3,59,336), date formatters, `STATUS_META` (8 status → label + color chip), payment/cancel/return reason maps | Bangladeshi number formatting like the SRS examples |

### 7.2 The 13 pages

| # | Page (route) | What it shows / does | Requirement |
|---|---|---|---|
| 1 | **Login** `/login` | Email+password, error box, **one-click demo account chips** | FR-02, NFR-04 |
| 2 | **Register** `/register` | Creates business + owner in one step (name, business, email, phone, password, currency) | FR-01, FR-04 |
| 3 | **Dashboard** `/` | 4 KPI cards (today/week/month/profit with % change), **AI insight banner** (top insight, links to AI page), 6-cell status strip, 30-day sales area-chart, **low-stock alert list**, top-5 products table, order pipeline panel | FR-20, FR-09 |
| 4 | **Orders** `/orders` | Search (order-no/customer/phone), 8 status filter chips, pagination, per-row **COD badge + AI risk chip**; clicking a row opens detail | FR-15 |
| 5 | **Order detail** `/orders/:id` | Full lifecycle: items+totals, customer card, payment panel (COD: collected/courier/return charges), delivery/tracking, cancellation record, returns table. **Action buttons follow BR-01** (Confirm → Process → Ship → Out for delivery → Mark Delivered → Record Return; Cancel only pre-ship, with reason modal). **"AI Risk Score" button** scores this order live and shows cancel%/return%/level + call-before-dispatch advice | FR-13/14/16/18/19, BR-01, FR-26 |
| 6 | **New Order** `/orders/new` | POS-style: customer picker (+quick-add), product search+add, qty (stock-validated), discount/delivery/courier charges, payment method, source (facebook/instagram/website/phone), "create as pending or confirmed" | FR-13 |
| 7 | **Products** `/products` | Table (cost/price/margin/stock status/reorder@), search, category modal, add/edit modal, soft-delete | FR-05/06/07 |
| 8 | **Inventory** `/inventory` | Two tabs: **Overview** (stock, status, lead time, stock value) and **Movement History** (full ledger with +/− and balance). Adjust modal (restock/damaged/signed adjustment) | FR-08/10, BR-02 |
| 9 | **Customers** `/customers` | List with per-customer history (orders, completed, cancelled, returned, spend, **risk badge**) + detail drawer with order history | FR-11/12 |
| 10 | **Analytics** `/analytics` | Period switcher (today→all), KPI row, **daily/monthly composed chart** (revenue line + units bars), product performance table with return%/cancel%, **profit donut + cost breakdown — owner/admin only** (BR-04) | FR-20/21/22/23 |
| 11 | **AI Insights** `/ai` | 5 tabs: **Insights** (severity-colored cards), **Forecast** (7/30/90-day picker, KPIs + 80% band + curve), **Demand** (per-product prediction + trend + share bars), **Order Risk** (every open order with risk bars + level), **Inventory Recs** (velocity, predicted demand, days of cover, buy quantity, action) | FR-24…28 |
| 12 | **AI Assistant** `/assistant` | Chat UI: suggested-question chips, answer bubbles with intent tag, **data-driven follow-up chips**, typing indicator | FR-29 |
| 13 | **Settings** `/settings` | Business profile (name/currency/contact), **Team** (add manager/staff, enable/disable), **Expenses** (owner-only, feeds profit formula) | FR-04, §7 roles |

**Routing & protection:** `App.jsx` wraps all app routes in `<Protected>` (redirects to /login if no session); auth pages redirect away if logged in.

---

## 8. Business Rules — Where and How Enforced

| Rule | Requirement | Where enforced | How | Test |
|---|---|---|---|---|
| **BR-01** An order cannot be delivered unless shipped | Order integrity | `models/order.js` `STATUS_TRANSITIONS` + `orderService.assertTransition` | Strict transition map; `pending→delivered` etc. throw `400 Invalid status transition` | `orderWorkflow.test.js` — 6 cases |
| **BR-02** Inventory cannot become negative | Stock integrity | `inventoryService.applyStockChange` + DB `min:0` on Inventory | Throws `400 Insufficient stock for product X: have N, need M` and rolls back the transaction | oversell API test → 400 |
| **BR-03** Only authorized users modify prices | Pricing control | `catalogController.updateProduct` | Role check owner/manager/admin before accepting `sellingPrice/costPrice` changes | RBAC suite |
| **BR-04** Financial reports only for authorized users | Confidentiality | `requireFinanceAccess` middleware on `/analytics/profit` + `/expenses`; UI hides Analytics-profit & Settings-Expenses for non-owners | 403 otherwise | staff→403 / owner→200 test |
| **BR-05** Returns update inventory by condition | Stock accuracy | `orderService.recordReturn` | `resellable` → restock via ledger; `damaged` → no restock, cost counted lost in profit | happy-path lifecycle test |
| **BR-06** AI only with sufficient data | Honest AI | `models.py` MIN_DAYS/MIN_ROWS/MIN_ORDERS gates | Returns `sufficientData:false` + reason; UI shows friendly notice | pytest insufficient-data test |
| **BR-07** Predictions are estimates | Honest AI | Every AI response in `main.py` | `disclaimer` field; shown in UI footers | pytest contract test |

---

## 9. Security Implementation (SRS §29, NFR-05)

| Concern | Implementation | File |
|---|---|---|
| Password storage | **bcrypt** hash (cost 10) — verified never stored in plain (unit test asserts `passwordHash ≠ password` and `bcrypt.compare` passes) | `authController.register/login` |
| Authentication | JWT (7-day expiry), signed with `JWT_SECRET`; production refuses the default secret | `env.js`, `auth.js` |
| Authorization | Permission matrix per role on every route + finance guard | `middleware/auth.js` |
| Data protection (29.4) | Every query scoped by `businessId` from the token's user — cross-business ID guessing returns 404 | all controllers/services |
| Input validation (29.5) | express-validator on auth payloads + Sequelize model validators (email, min prices, quantity ≥1) → uniform 400 errors | models, routes |
| API security (29.6) | Protected routes require `Authorization: Bearer`; rate limit 50/15min on auth endpoints | `routes/index.js` |
| Transport/headers | helmet security headers; CORS configurable | `app.js` |
| Hash exposure | `User.toPublicJSON()` — every response path strips `passwordHash` | `models/user.js` |
| Frontend session | 401 interceptor wipes token + redirects; role-aware UI hides restricted data | `api/client.js`, `AuthContext` |

---

## 10. Testing (SRS §35)

### 10.1 Backend — Jest + supertest, **25 tests, all passing**

| Suite | Covers |
|---|---|
| `profit.test.js` | FR-22 formula end-to-end: revenue math, return reversal, damaged-return cost loss, margin, exclusion of non-completed orders |
| `orderWorkflow.test.js` | BR-01 transition matrix: deliver-requires-shipping, cancel-only-before-ship, return-only-from-delivered, terminal/self transitions |
| `auth.validation.test.js` | Integration against a **scratch SQLite DB**: registration+hashing, duplicate email 409, wrong password 401, token-less access 401, **BR-04 staff-blocked-from-profit**, product CRUD + initial-stock ledger, BR-02 oversell rejection, full happy path (create→confirm[stock−5]→cancel[stock restored]) and full return path |

> **Safety fix worth knowing (viva story):** tests originally set only `DB_STORAGE` (a separate SQLite file). After the project switched to PostgreSQL, running `npm test` would have synced `force:true` against the **real** database and wiped it — which happened once on the dev machine. The suite now **forces `DB_DIALECT=sqlite` in code**, so tests can never touch PostgreSQL regardless of `.env`.

### 10.2 AI service — pytest, **21 tests, all passing**

Feature engineering (UTC parsing, flags, BD weekend), forecaster bounds (`lower ≤ predicted ≤ upper`, non-negative, insufficient-data refusal), risk ranges and levels, recommender flags the starved product, insight structure, **all six intent detections** including the four SRS example questions, and the FastAPI endpoint contracts (series length, disclaimer, 503-free graceful paths).

### 10.3 System & UAT

End-to-end verified in a real browser: login as all 4 roles (menus differ correctly), dashboard KPIs/chart/alerts, order create→confirm (stock visibly deducted)→pipeline buttons update, AI tabs (forecast trained on 310 days, 14+ open orders scored, restock advice present), assistant answers grounded in live data. The UAT script from SRS §35 (Login → Add Product → Add Customer → Create Order → Update Inventory → Complete Order → View Analytics → View AI Recommendation) is executable in the UI and each step also has an automated test.

---

## 11. Demo Data (Seed) Design — why the demo looks alive

`backend/src/seed/seed.js` builds **"GhorerBazaar BD"**, a Dhaka online fashion business:

- **Deterministic PRNG (mulberry32, fixed seed)** — every reseed produces the same numbers, so screenshots/reports stay reproducible.
- **10 months, day by day** (~1,650–1,680 orders): monthly volume grows 0.55×→1.35× (trend), **Friday/Saturday peaks** (BD weekend), two festival spikes, daily noise.
- **65 customers**, ~20% flagged "risky" — they cancel/return more, giving the risk model a learnable pattern.
- **18 products** in 5 categories with realistic BD prices (৳250 Panjabi… ৳2,400 Abaya), per-product **return rates** (footwear ~19% vs accessories ~5%).
- **Payment reality:** 78% COD, bKash/Nagad/card split; courier charges ৳50 (Dhaka) / ৳85+ (outside).
- **Lifecycle simulation:** orders walk the real pipeline; ~8–12% cancel (mostly COD >৳3,000 — exactly the pattern the risk model should catch); returns happen after delivery with SRS-style reasons; damaged/resellable split.
- **Recent 5 days** contain open orders (pending→shipped) — material for live risk scoring; yesterday–4-days-ago orders partly delivered so weekly revenue isn't zero.
- **Two products deliberately starved** (stock 2–6) → low-stock notifications + "reorder now" recommendations always demo well.
- 33 monthly expenses (marketing/packaging/transport) so the FR-22 formula has all terms.

---

## 12. How to Run

**One-click (Windows):** double-click `start.bat` (or `.\start.bat` from the VS Code PowerShell terminal) → opens 3 service windows + browser at http://localhost:5173. `stop.bat` stops everything.

**Manual (3 terminals):**

```bat
cd ai-service && python -m uvicorn app.main:app --port 8001   :: AI
cd backend   && npm run dev                                    :: API (needs DB up)
cd frontend  && npm run dev                                    :: Web
```

**First time on a new machine:** Node.js 18+ and Python 3.10+ → `npm install` (backend & frontend), `pip install -r requirements.txt` (ai-service), `npm run seed` (backend) — full checklist in `SETUP-FOR-TEAM.txt`.

**Database:** demo zip defaults to SQLite (zero setup). Production/dev machine uses PostgreSQL: create DB `bizmind`, set `.env` (`DB_DIALECT=postgres`, host/port/user/pass), `npm run seed`. pgAdmin connects with the same credentials.

---

## 13. Complete File Map

```
D:\bizmind-ai\
├── start.bat / stop.bat        ← one-click start/stop (3 windows + browser)
├── SETUP-FOR-TEAM.txt          ← setup steps for anyone receiving the project
├── package.json                ← root convenience scripts (dev:ai/dev:api/dev:web/test)
├── README.md                   ← project overview + quick start + feature coverage
│
├── backend\                    ← Node.js + Express REST API (port 5000)
│   ├── .env                    ← ACTIVE config (postgres on dev machine)
│   ├── .env.sqlite-backup      ← sqlite config (demo zip default)
│   ├── .env.example            ← template
│   ├── package.json            ← deps + scripts (dev/seed/test)
│   ├── data\                   ← SQLite databases (bizmind.sqlite, test.sqlite)
│   ├── src\
│   │   ├── server.js           ← boot: DB connect + sync + listen
│   │   ├── app.js              ← Express: helmet/cors/json → /api → errors
│   │   ├── config\env.js       ← .env loader (+production secret guard)
│   │   ├── config\database.js  ← postgres/sqlite dialect switch
│   │   ├── models\             ← 17 entities (see §4/§5.3)
│   │   │   ├── index.js        ←   associations (Business→…→OrderItems)
│   │   │   ├── order.js        ←   ★ STATUS_TRANSITIONS (BR-01 source of truth)
│   │   │   ├── inventory.js    ←   ★ stock + ledger
│   │   │   └── fulfillment.js  ←   payments/returns/cancellations/deliveries
│   │   ├── middleware\auth.js  ← ★ JWT + permission matrix + finance guard
│   │   ├── middleware\errorHandler.js
│   │   ├── services\
│   │   │   ├── orderService.js       ← ★ order brain (create/status/return/search)
│   │   │   ├── inventoryService.js   ← ★ applyStockChange (BR-02) + low-stock
│   │   │   ├── analyticsService.js   ← ★ FR-20..23 aggregations
│   │   │   └── aiGateway.js          ← ★ bundle builder → Python + prediction log
│   │   ├── controllers\        ← auth, catalog, crm, analytics (thin HTTP)
│   │   ├── routes\index.js     ← ★ endpoint → permission → controller map
│   │   ├── utils\profit.js     ← ★ FR-22 formula (pure functions)
│   │   └── seed\seed.js        ← ★ 10-month demo history generator
│   └── tests\                  ← 25 Jest tests (3 suites)
```

*(continues — AI service, frontend, docs:)*

```
├── ai-service\                 ← Python FastAPI ML microservice (port 8001)
│   ├── requirements.txt        ← fastapi/uvicorn/sklearn/pandas/xgboost/pytest
│   ├── app\main.py             ← ★ 6 POST endpoints + health
│   ├── app\core\features.py    ← ★ DataFrames + leakage-free features
│   ├── app\core\models.py      ← ★ SalesForecaster / DemandModel / RiskModel / cache
│   ├── app\core\recommender.py ← ★ FR-27 policy + FR-28 insight detectors
│   ├── app\core\assistant.py   ← ★ FR-29 intent matcher + grounded answers
│   └── tests\test_ai.py        ← 21 pytest tests
│
├── frontend\                   ← React SPA (port 5173)
│   ├── index.html, vite.config.js (proxy /api→5000), tailwind/postcss configs
│   └── src\                    ← see §7 (api/, context/, components/, pages/, utils/)
│
├── docs\
│   ├── PROJECT_DOCUMENTATION.md ← ★ THIS DOCUMENT
│   ├── ARCHITECTURE.md          ← layers, model design, data-flow rationale
│   ├── API.md                   ← full endpoint reference
│   └── TEST_REPORT.md           ← test levels vs SRS §35
│
└── _backup_old_version\        ← previous backend attempt (kept for reference)
```

★ = the files that carry the project's core logic; if you read only those, you understand the system.

---

## 14. Key Design Decisions — The "Why" List

| # | Decision | Why |
|---|---|---|
| 1 | **Server-computed money** (totals from catalog, prices snapshotted on items) | Client can't tamper; historical profit is immutable even if catalog prices change later |
| 2 | **Stock deducted on confirm, not on create** | Matches BD practice (pending = phone-confirmation stage); avoids phantom stock-outs |
| 3 | **One choke-point for stock changes** (`applyStockChange`) + transactional ledger | BR-02 impossible to bypass; every movement auditable with running balance |
| 4 | **Soft delete for products** | FR-07: old orders must keep showing product names/history |
| 5 | **No Sales table — derive analytics** | One source of truth; no sync bugs between order status and sales rows |
| 6 | **AI as stateless microservice fed by data bundles** | SRS architecture; no duplicated ORM in Python; authorization stays in Node; trivially testable |
| 7 | **XGBoost + Ridge blend, recursive forecasting** | GBM captures seasonality/spikes, Ridge stabilizes; widening 80% band = honest uncertainty |
| 8 | **Leak-free customer features** (expanding window, shifted) | The risk model must predict from *past* behavior, not peek at the answer |
| 9 | **Rule-based assistant, not an external LLM** | Offline, key-free, deterministic, auditable — every number traceable to the DB (viva-friendly) |
| 10 | **Deterministic seed with realistic BD patterns** | Reproducible demo; ML has trend+seasonality+risk patterns to actually learn |
| 11 | **Dual database dialect** | SRS demands PostgreSQL; SQLite mode makes the project runnable anywhere in seconds |
| 12 | **Tests forced to SQLite scratch file** | After a real incident where `npm test` wiped the postgres DB via `sync({force:true})` |
| 13 | **Role permission matrix (one table)** | Whole RBAC policy visible at a glance; enforced server-side, mirrored in UI |
| 14 | **Risk scores cached on orders** | Order list shows chips instantly; full re-scoring only on demand |
| 15 | **BD-localized details** (৳ + Indian digit grouping, Fri/Sat weekend feature, COD economics, Steadfast/Pathao couriers) | The product is for BD sellers — the SRS examples themselves use ৳ |

---

## 15. Limitations and Future Enhancements

**Current limitations (SRS §37, honestly held):**
1. Prediction quality depends on history volume/quality (gated by BR-06 minimums)
2. AI results are estimates — never guarantees (disclaimed everywhere per BR-07)
3. No live courier / Facebook / Instagram / payment-gateway integrations — fields and enums (`placedVia`, courier, tracking) are ready as hooks
4. Simplified financials vs professional accounting software
5. `sequelize.sync()` instead of versioned migrations (academic scope)
6. Single-machine deployment; JWTs aren't revocable server-side (short expiry chosen instead)

**Natural next steps (SRS §38):**
- Facebook/Instagram order import · courier API tracking · online payment gateways
- Advanced time-series models (Prophet/ARIMA comparison) · Bengali-language assistant
- Multi-business agency mode · expense/tax/cash-flow accounting
- Docker one-command deployment · GitHub Actions CI running both test suites

---

*Documentation generated for the BizMind AI project — cross-references: [README.md](../README.md) · [docs/ARCHITECTURE.md](ARCHITECTURE.md) · [docs/API.md](API.md) · [docs/TEST_REPORT.md](TEST_REPORT.md)*
