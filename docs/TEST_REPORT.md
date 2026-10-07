# BizMind AI — Test Report (SRS §35)

## 1. Unit tests — backend (`npm test`, Jest) — 25/25 ✅

**Profit formula (FR-22)** — `tests/profit.test.js`
- revenue = subtotal − discount, floored at 0
- profit = revenue − product cost − delivery cost − return cost − other expenses
- returns reverse revenue; damaged returns additionally lose product cost
- margin = profit / net revenue
- cancelled/pending orders excluded from revenue

**Order workflow (BR-01)** — `tests/orderWorkflow.test.js`
- delivered requires shipped → out_for_delivery → delivered chain
- cancellation allowed only before shipping; returns only from delivered
- terminal states (cancelled/returned) allow no transitions; self-transitions rejected

**Auth & validation (FR-01/02, NFR-05, 29.x)** — `tests/auth.validation.test.js` (integration, supertest)
- registration hashes passwords with bcrypt (never plain text)
- duplicate email → 409; wrong password → 401 with safe message
- protected routes reject missing tokens → 401
- staff blocked from financial reports (BR-04) and user management (FR-03)

**Products & inventory (FR-05–10, BR-02)**
- initial stock logged as inventory transaction
- stock cannot go negative (BR-02) → 400 “Insufficient stock”
- product delete is soft (FR-07)

**Full lifecycle via API**
- create → confirm deducts stock → cancel restores stock
- oversell attempt → 400
- pending → … → delivered → return restocks resellable units (BR-05), full return flips order to `returned` + refund

## 2. AI service tests (`python -m pytest`, 21/21 ✅)

- feature engineering: UTC ISO parsing → tz-naive, flags, BD-weekend calendar, growth rate direction
- forecaster: 30 predictions, `lower ≤ predicted ≤ upper`, non-negative; <14 days history → `sufficientData:false` (BR-06)
- risk model: scores all open orders, probabilities ∈ [0,100], levels ∈ {LOW, MEDIUM, HIGH}
- recommender: starved product (high demand, 4 units) → `reorder` with purchase quantity
- insights: generated, ranked, all fields present
- assistant: all SRS example questions map to the correct intent; best-seller answer contains real figures
- API contracts: `/health`, forecast series length, disclaimer present (BR-07), insufficient-data path

## 3. System testing (manual, end-to-end)

Verified in-browser against the seeded demo business:
- login (owner/manager/staff role menus differ correctly)
- dashboard KPIs, chart, low-stock alerts, top products
- order create → confirm (stock −1 verified) → pipeline buttons update
- AI Insights tabs: forecast (XGBoost, 310 training days), risk (14 open orders scored), demand, inventory recs
- assistant answers “Why did my profit decrease this month?” with live numbers
- staff role: financial endpoints/UI hidden (BR-04 verified from both sides)

## 4. User acceptance testing script (SRS §35)

Login → Add Product → Add Customer → Create Order → Update Inventory → Complete Order → View Analytics → View AI Recommendation — all steps executable in the UI; each also covered by an automated test above.
