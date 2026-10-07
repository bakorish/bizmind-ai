"""BizMind AI — Python/FastAPI AI/ML microservice.

Endpoints mirror SRS 25.2 (`GET /api/ai/*` on the Node backend, which proxies
to the POST endpoints here with the business data bundle).
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .core import features as F
from .core.models import (
    STORE,
    model_label,
    open_orders_frame,
    train_demand,
    train_forecaster,
    train_risk,
)
from .core.recommender import generate_insights, recommend_inventory
from .core.assistant import answer_question

app = FastAPI(title="BizMind AI Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

DISCLAIMER = "AI predictions are estimates based on historical data, not guaranteed outcomes."  # BR-07


class Bundle(BaseModel):
    # The backend posts the full data bundle; keep it schema-loose.
    model_config = {"extra": "allow"}

    business: Optional[dict] = None
    orders: list = []
    products: list = []
    customers: list = []
    monthlySeries: list = []
    dailySeries: list = []
    profit: Optional[dict] = None
    settings: Optional[dict] = None


class ForecastRequest(Bundle):
    horizon_days: int = 30


class DemandRequest(Bundle):
    product_id: Optional[int] = None


class RiskRequest(Bundle):
    order_id: Optional[int] = None


class AssistantRequest(Bundle):
    question: str = ""


@app.get("/health")
def health():
    return {"status": "ok", "service": "bizmind-ai", "models": model_label()}


@app.post("/api/forecast/sales")
def forecast_sales(req: ForecastRequest):
    bundle = req.model_dump()
    horizon = max(1, min(req.horizon_days, 90))
    model, meta = train_forecaster(bundle)
    if not meta.get("sufficient"):
        return {"sufficientData": False, "reason": meta.get("reason"), "disclaimer": DISCLAIMER}
    cached = STORE.get(bundle["business"]["id"] if bundle.get("business") else "anon", bundle, "forecast", lambda: (model, meta))[1]
    preds = model.predict(horizon)
    total = sum(p["predictedUnits"] for p in preds)
    return {
        "sufficientData": True,
        "horizonDays": horizon,
        "predictedUnits": round(total, 0),
        "predictedPerDay": round(total / horizon, 1),
        "lower": round(sum(p["lower"] for p in preds), 0),
        "upper": round(sum(p["upper"] for p in preds), 0),
        "trendPct": round(model.trend * 100, 1),
        "series": preds,
        "trainingRows": meta.get("rows"),
        "model": model_label(),
        "disclaimer": DISCLAIMER,
    }


@app.post("/api/predict/demand")
def predict_demand(req: DemandRequest):
    bundle = req.model_dump()
    model, meta = train_demand(bundle)
    if not meta.get("sufficient"):
        return {"sufficientData": False, "reason": meta.get("reason"), "disclaimer": DISCLAIMER}
    preds = model.predict(30)
    if req.product_id:
        preds = [p for p in preds if p["productId"] == req.product_id]
    return {
        "sufficientData": True,
        "horizonDays": 30,
        "predictions": preds,
        "model": model_label(),
        "disclaimer": DISCLAIMER,
    }


@app.post("/api/predict/risk")
def predict_risk(req: RiskRequest):
    bundle = req.model_dump()
    model, meta = train_risk(bundle)
    if not meta.get("sufficient"):
        return {"sufficientData": False, "reason": meta.get("reason"), "disclaimer": DISCLAIMER}
    open_df = open_orders_frame(bundle)
    scored = model.predict(open_df)
    if req.order_id:
        scored = [r for r in scored if r["orderId"] == req.order_id]
    return {
        "sufficientData": True,
        "trainingStats": meta,
        "orders": scored,
        "highRisk": [r for r in scored if r["riskLevel"] == "HIGH"],
        "model": model_label(),
        "disclaimer": DISCLAIMER,
    }


@app.post("/api/recommend/inventory")
def recommend(req: Bundle):
    bundle = req.model_dump()
    result = recommend_inventory(bundle)
    result["disclaimer"] = DISCLAIMER
    return result


@app.post("/api/insights")
def insights(req: Bundle):
    bundle = req.model_dump()
    result = generate_insights(bundle)
    result["generatedAt"] = F.parse_date(bundle["orders"][-1]["orderDate"]).isoformat() if bundle.get("orders") else None
    return result


@app.post("/api/assistant")
def assistant(req: AssistantRequest):
    bundle = req.model_dump()
    return answer_question(bundle, req.question)
