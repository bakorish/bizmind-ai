"""AI service tests: forecaster, demand, risk, recommender, insights, assistant.

Run:  python -m pytest tests/ -q
"""
from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.features import parse_date, orders_frame, daily_sales_frame, growth_rate, calendar_features
from app.core.models import SalesForecaster, train_forecaster, train_risk, open_orders_frame
from app.core.recommender import generate_insights, recommend_inventory, pct
from app.core.assistant import detect_intent, answer_question

client = TestClient(app)


# ---------------------------------------------------------------- helpers
def make_bundle(n_orders: int = 260, seed: int = 7) -> dict:
    """Synthetic bundle resembling the backend payload: ~9 months of orders with
    a mild upward trend, weekend bumps, COD-heavy, some cancels/returns."""
    rng = random.Random(seed)
    products = [
        {"id": 1, "name": "Black T-Shirt", "sku": "TS-1", "sellingPrice": 450, "costPrice": 200, "reorderLevel": 10, "leadTimeDays": 7, "currentStock": 40},
        {"id": 2, "name": "Panjabi", "sku": "PJ-1", "sellingPrice": 1450, "costPrice": 680, "reorderLevel": 8, "leadTimeDays": 10, "currentStock": 4},
        {"id": 3, "name": "Loafers", "sku": "FW-1", "sellingPrice": 1200, "costPrice": 550, "reorderLevel": 6, "leadTimeDays": 14, "currentStock": 60},
    ]
    orders = []
    start = datetime.now() - timedelta(days=270)
    for i in range(n_orders):
        day = start + timedelta(days=(270 * i) // n_orders)
        if day.weekday() in (4, 5):
            day += timedelta(hours=rng.choice([0, 24]))  # weekend bump
        status = "delivered"
        r = rng.random()
        if r < 0.08:
            status = "cancelled"
        elif r < 0.15:
            status = "returned"
        pid = rng.choice([1, 2, 3])
        qty = rng.choice([1, 1, 2])
        unit_price = next(p["sellingPrice"] for p in products if p["id"] == pid)
        orders.append(
            {
                "id": i + 1, "orderNo": f"BM-T-{i+1:05d}", "customerId": rng.randint(1, 40),
                "customerName": f"C{i}", "city": rng.choice(["Dhaka", "Chattogram"]),
                "status": status, "orderDate": (day + timedelta(hours=rng.randint(9, 22))).isoformat() + "Z",
                "subtotal": unit_price * qty, "discount": 0, "deliveryCharge": 60,
                "total": unit_price * qty + 60, "paymentMethod": "cod" if rng.random() < 0.8 else "bkash",
                "placedVia": "facebook",
                "deliveredAt": None, "cancelledAt": None, "returnedAt": None,
                "courierCharge": 50,
                "items": [{"productId": pid, "productName": next(p["name"] for p in products if p["id"] == pid),
                            "quantity": qty, "unitPrice": unit_price, "unitCost": next(p["costPrice"] for p in products if p["id"] == pid)}],
                "returnReasons": [{"productId": pid, "quantity": 1, "reason": "size_issue", "condition": "resellable"}] if status == "returned" else [],
                "cancellationReason": "customer_changed_mind" if status == "cancelled" else None,
            }
        )
    # a couple of open orders for risk scoring
    for j in range(3):
        orders.append({
            "id": 10000 + j, "orderNo": f"BM-T-OPEN{j}", "customerId": 5, "customerName": "Open C",
            "city": "Dhaka", "status": "pending", "orderDate": (datetime.now() - timedelta(hours=5)).isoformat() + "Z",
            "subtotal": 2900, "discount": 0, "deliveryCharge": 60, "total": 2960, "paymentMethod": "cod",
            "placedVia": "instagram", "deliveredAt": None, "cancelledAt": None, "returnedAt": None, "courierCharge": 50,
            "items": [{"productId": 2, "productName": "Panjabi", "quantity": 2, "unitPrice": 1450, "unitCost": 680}],
            "returnReasons": [], "cancellationReason": None,
        })
    return {
        "business": {"id": 1, "name": "Test", "currency": "BDT", "settings": {}},
        "orders": orders, "products": products,
        "customers": [{"id": i, "name": f"C{i}", "city": "Dhaka"} for i in range(1, 41)],
        "monthlySeries": [], "dailySeries": [],
        "profit": {"revenue": 100000, "profit": 30000, "margin": 30, "returnCost": 2500, "deliveryCost": 4000,
                    "otherExpenses": 2000, "productCost": 60000, "profitChangePct": -5},
        "settings": {"safetyStockDays": 5},
    }


BUNDLE = None


def bundle():
    global BUNDLE
    if BUNDLE is None:
        BUNDLE = make_bundle()
    return BUNDLE


# ---------------------------------------------------------------- feature utils
def test_parse_date_handles_utc_iso():
    d = parse_date("2026-10-01T10:00:00Z")
    assert d is not None and d.tzinfo is None
    assert parse_date(None) is None


def test_orders_frame_flags():
    df = orders_frame(bundle())
    assert len(df) > 250
    assert set(["is_cod", "cancelled", "returned"]).issubset(df.columns)
    assert df["is_cod"].sum() > 0


def test_growth_rate_direction():
    assert growth_rate([100, 120, 144]) > 0.1
    assert growth_rate([100, 80, 60]) < -0.1
    assert growth_rate([0, 0]) == 0.0


def test_calendar_features_bd_weekend():
    fri = calendar_features(datetime(2026, 10, 2))  # Friday
    mon = calendar_features(datetime(2026, 10, 5))
    assert fri["is_bd_weekend"] == 1 and mon["is_bd_weekend"] == 0


# ---------------------------------------------------------------- forecaster
def test_forecaster_trains_and_predicts_in_range():
    model, meta = train_forecaster(bundle())
    assert meta["sufficient"] is True
    preds = model.predict(30)
    assert len(preds) == 30
    for p in preds:
        assert p["lower"] <= p["predictedUnits"] <= p["upper"]
        assert p["predictedUnits"] >= 0


def test_forecaster_insufficient_data():
    # BR-06: fewer than 14 days of sales history must refuse to forecast
    few = make_bundle(30)["orders"][:12]
    tiny = {"orders": [{**o, "orderDate": (datetime.now() - timedelta(days=3)).isoformat() + "Z"} for o in few]}
    model, meta = train_forecaster(tiny)
    assert meta["sufficient"] is False


# ---------------------------------------------------------------- risk
def test_risk_model_scores_open_orders():
    model, meta = train_risk(bundle())
    assert meta["sufficient"] is True
    open_df = open_orders_frame(bundle())
    scored = model.predict(open_df)
    assert len(scored) == 3
    for r in scored:
        assert 0 <= r["cancellationRiskPct"] <= 100
        assert 0 <= r["returnRiskPct"] <= 100
        assert r["riskLevel"] in ("LOW", "MEDIUM", "HIGH")


# ---------------------------------------------------------------- recommender + insights
def test_inventory_recommendation_flags_starved_product():
    rec = recommend_inventory(bundle())
    assert rec["sufficientData"] is True
    names = {r["productName"]: r for r in rec["recommendations"]}
    # Panjabi has 4 in stock with high demand -> must trigger reorder
    assert names["Panjabi"]["action"] == "reorder"
    assert names["Panjabi"]["recommendedPurchase"] > 0


def test_insights_generated():
    result = generate_insights(bundle())
    assert result["sufficientData"] is True
    assert len(result["insights"]) >= 1
    assert all("title" in i and "severity" in i for i in result["insights"])


def test_pct_helper():
    assert pct(110, 100) == 10.0
    assert pct(50, 100) == -50.0
    assert pct(10, 0) == 100.0


# ---------------------------------------------------------------- assistant
@pytest.mark.parametrize(
    "question,intent",
    [
        ("What are my best-selling products?", "best_sellers"),
        ("Why did my profit decrease this month?", "profit_question"),
        ("Which products are likely to run out of stock?", "stock_out"),
        ("What is my sales forecast?", "forecast"),
        ("Which product should I promote?", "promote"),
        ("How many cancellations do I have?", "cancellations"),
    ],
)
def test_intent_detection(question, intent):
    assert detect_intent(question) == intent


def test_assistant_best_sellers_answer_has_numbers():
    res = answer_question(bundle(), "What are my best-selling products?")
    assert res["intent"] == "best_sellers"
    assert "৳" in res["answer"] or "units" in res["answer"]
    assert res["suggestedFollowups"]


# ---------------------------------------------------------------- API surface
def test_health_endpoint():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_forecast_endpoint_contract():
    r = client.post("/api/forecast/sales", json={**bundle(), "horizon_days": 7})
    body = r.json()
    assert r.status_code == 200
    assert body["sufficientData"] is True
    assert len(body["series"]) == 7
    assert body["disclaimer"]  # BR-07


def test_risk_endpoint_contract():
    r = client.post("/api/predict/risk", json={**bundle()})
    body = r.json()
    assert body["sufficientData"] is True
    assert len(body["orders"]) == 3


def test_insufficient_data_disclaimer_path():
    small = {**bundle(), "orders": bundle()["orders"][:10]}
    r = client.post("/api/forecast/sales", json={**small, "horizon_days": 7})
    body = r.json()
    assert body["sufficientData"] is False
    assert body["disclaimer"]
