# BizMind AI — API Reference

Base URL: `http://localhost:5000/api` · Auth: `Authorization: Bearer <JWT>`
Roles: `owner` · `manager` · `staff` · `admin`. Financial endpoints require owner/admin (BR-04).

## Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{name,email,password,phone?,businessName,currency?}` | creates business + owner, returns token |
| POST | `/auth/login` | `{email,password}` | FR-02 |
| GET | `/auth/me` | — | current user + business |

## Users / Business
| Method | Path | Permission |
|---|---|---|
| GET/POST | `/users` · PUT `/users/:id` | `users` (owner/admin) |
| GET | `/business` | any member |
| PUT | `/business` | `settings` |

## Catalog & Inventory
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/categories`, PUT/DELETE `/categories/:id` | |
| GET | `/products?search=&categoryId=&lowStock=&includeInactive=` | includes stock + margin |
| GET | `/products/:id` | + inventory ledger |
| POST/PUT/DELETE | `/products[/:id]` | soft delete (FR-07); price edits owner/manager (BR-03) |
| GET | `/inventory` | overview + lowStockCount |
| GET | `/inventory/history?productId=` | movement ledger (FR-10) |
| POST | `/inventory/adjust` | `{productId,type:restock|damaged|adjustment,quantity,note?}` |

## Customers & Orders
| Method | Path | Notes |
|---|---|---|
| GET | `/customers?search=` | with history stats (FR-12) |
| GET | `/customers/:id` | + last 50 orders |
| POST/PUT | `/customers[/:id]` | |
| GET | `/orders?q=&status=&from=&to=&productId=&customerId=&page=&limit=` | search (FR-15) |
| GET | `/orders/:id` | items, payments, delivery, returns, cancellation |
| POST | `/orders` | `{customerId,items:[{productId,quantity,unitPrice?}],discount?,deliveryCharge?,paymentMethod?,courierName?,courierCharge?,initialStatus?}` — totals computed server-side |
| PUT | `/orders/:id` | `{status, reason?, note?}` — BR-01 transitions, stock effects |
| POST | `/orders/:id/returns` | `{items:[{productId,quantity,reason,condition}],note?}` — BR-05 |
| GET | `/returns` · `/cancellations` | listings + reason aggregates |

## Analytics
| Method | Path | Notes |
|---|---|---|
| GET | `/analytics/dashboard` | one-call dashboard bundle |
| GET | `/analytics/sales?period=today|week|month|quarter|year|all` | FR-20/21 |
| GET | `/analytics/profit?period=` | **owner/admin only** (BR-04), FR-22 |
| GET | `/analytics/products?period=` | FR-23 |
| GET | `/analytics/series?granularity=daily|monthly` | chart series |
| GET/POST/DELETE | `/expenses[/:id]` | feeds profit formula |

## AI (proxied to Python service)
| Method | Path | Returns |
|---|---|---|
| GET | `/ai/sales-forecast?days=7|30|90` | predicted units + per-day series + 80% band (FR-24) |
| GET | `/ai/demand-prediction?productId=` | per-product 30-day demand + trend (FR-25) |
| GET | `/ai/risk-prediction?orderId=` | cancel/return % + risk level for open orders (FR-26) |
| GET | `/ai/recommendations` | reorder quantities + days of cover (FR-27) |
| GET | `/ai/insights` | ranked business insights (FR-28) |
| POST | `/ai/assistant` `{question}` | NL answer + data + follow-ups (FR-29) |
| GET | `/ai/recommendations/list` · PUT `/ai/recommendations/:id/status` | persisted recommendations |

## Notifications
`GET /notifications` (FR-09 low-stock alerts) · `POST /notifications/read-all`

## Errors
`{"success":false,"message":"..."}` with proper status codes (400 validation, 401 auth, 403 RBAC, 404, 409 conflict, 503 AI service down).
