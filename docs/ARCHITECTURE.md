# BizMind AI — Architecture

## System layers (SRS §26)

```
┌─────────────────────────────────────────────────────────┐
│  Presentation — React 18 + Vite + Tailwind + Recharts   │
│  AuthContext · Layout · 13 pages                        │
└──────────────────────────┬──────────────────────────────┘
                           │ REST (JWT bearer)
┌──────────────────────────▼──────────────────────────────┐
│  Application — Node.js + Express                        │
│  routes → middleware (auth/RBAC/validate) → controllers │
│  services: orderService · inventoryService ·            │
│            analyticsService · aiGateway                 │
└───────────┬──────────────────────────────┬──────────────┘
            │ Sequelize                    │ HTTP (data bundle)
┌───────────▼──────────────┐   ┌───────────▼──────────────┐
│  Data — PostgreSQL       │   │  AI/ML — Python FastAPI  │
│  (SQLite for local demo) │   │  XGBoost · sklearn ·     │
│  17 entities             │   │  pandas feature pipeline │
└──────────────────────────┘   └──────────────────────────┘
```

## Key design decisions

**Multi-tenancy** — every business entity carries `businessId`; all queries are scoped by it (SRS §29.4). Platform admins can span businesses.

**Order lifecycle (BR-01)** — enforced in one place (`STATUS_TRANSITIONS`):
`pending → confirmed → processing → shipped → out_for_delivery → delivered → returned`
with cancellation allowed only before shipping. Stock is deducted on **confirm** and restored on cancel/return (BR-02, BR-05). Every movement writes an `InventoryTransaction` ledger row with `balanceAfter` (FR-10).

**Server-computed money** — order totals, line prices and profit are always computed backend-side from catalog snapshots (`unitPrice`/`unitCost` frozen on `OrderItem`), so client tampering is impossible and historical profit is stable.

**AI integration** — the backend builds a full *data bundle* (orders + items + payments + returns + products + stock + monthly/daily series + profit metrics) and POSTs it to the Python service, which trains per-business models (cached by data fingerprint + 10-minute TTL) and returns predictions. The backend logs every prediction (`AI_Predictions`), persists actionable ones (`AI_Recommendations`), and caches risk scores on open orders.

**Model inventory**

| Feature | Model | Features |
|---|---|---|
| Sales forecast | XGBoost + Ridge blend, recursive multi-step | lags 1/2/3/7/14/30, rolling mean/std, calendar (day-of-week, BD weekend, month, trend) |
| Demand | XGBoost regressor | product code, price, discount, margin, calendar |
| Cancel/return risk | 2× XGBoost classifiers | customer prior cancel/return rate (leak-free expanding window), COD flag, order value, item count, city, spend history |
| Inventory rec | Safety-stock policy on ML demand | current stock, velocity, lead time, safety days, reorder level |
| Insights | Rule-based analytics on model outputs | MoM daily-avg deltas, return/cancel pressure, COD concentration, discounts |
| Assistant | Intent matcher → templated answers grounded in the data bundle | 11 intents incl. all 4 SRS example questions |

**Graceful degradation** — if the AI service is down, `/api/ai/*` returns 503 with a clear message instead of breaking business operations.

## Data model (17 entities)

Business · User · Category · Product · Customer · Order · OrderItem · Inventory · InventoryTransaction · Payment · ReturnRecord · Cancellation · Delivery · Expense · AIPrediction · AIRecommendation · Notification

*(The SRS "Sales" entity is realised as derived aggregates — daily/monthly series and the analytics endpoints — avoiding a second source of truth for revenue.)*
