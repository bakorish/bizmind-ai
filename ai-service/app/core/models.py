"""ML models: sales forecaster, demand regressor, order risk classifier.

Spec (SRS section 27) names XGBoost; we use it when importable and fall back to
scikit-learn's HistGradientBoosting so the service runs anywhere.
"""
from __future__ import annotations

import hashlib
import math
import time
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.linear_model import Ridge

from .features import (
    calendar_features,
    customer_history_features,
    enrich_series_features,
    orders_frame,
    daily_sales_frame,
    parse_date,
    growth_rate,
)

try:
    from xgboost import XGBClassifier, XGBRegressor

    XGB_OK = True
except Exception:  # pragma: no cover
    XGB_OK = False

MODEL_TTL_SECONDS = 600  # retrain at most every 10 minutes per business


def _regressor(seed: int = 42):
    if XGB_OK:
        return XGBRegressor(n_estimators=250, max_depth=4, learning_rate=0.08, subsample=0.9,
                            colsample_bytree=0.9, random_state=seed, verbosity=0)
    return HistGradientBoostingRegressor(max_iter=250, max_depth=4, learning_rate=0.08, random_state=seed)


def _classifier(seed: int = 42):
    if XGB_OK:
        return XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.1, subsample=0.9,
                             colsample_bytree=0.9, random_state=seed, verbosity=0, eval_metric="logloss")
    return HistGradientBoostingClassifier(max_iter=200, max_depth=4, learning_rate=0.1, random_state=seed)


def model_label() -> str:
    return ("XGBoost + Ridge blend" if XGB_OK else "HistGradientBoosting + Ridge blend")


# ---------------------------------------------------------------------------
# Sales forecasting (FR-24)
# ---------------------------------------------------------------------------
class SalesForecaster:
    """Predicts daily units for the next `horizon` days using calendar features,
    lags and rolling means; recursively rolls predictions forward. A Ridge blend
    smooths GBM noise. A simple trend/seasonality fallback covers very short
    histories."""

    MIN_DAYS = 14

    def train(self, daily_units: pd.Series) -> dict:
        df = daily_units.reset_index()
        df.columns = ["date", "units"]
        df = enrich_series_features(df, "units")
        cal = pd.DataFrame([calendar_features(d) for d in df["date"]])
        df = pd.concat([df.reset_index(drop=True), cal.reset_index(drop=True)], axis=1)
        df = df.replace([np.inf, -np.inf], 0).fillna(0)

        feature_cols = [c for c in df.columns if c not in ("date", "units")]
        X, y = df[feature_cols].values, df["units"].values
        self.feature_cols = feature_cols
        self.history = df[["date", "units"]].copy()

        self.gbm = _regressor()
        self.gbm.fit(X, y)
        self.ridge = Ridge(alpha=1.0)
        self.ridge.fit(X, y)
        # residual std -> rough confidence band
        preds = 0.7 * self.gbm.predict(X) + 0.3 * self.ridge.predict(X)
        self.residual_std = float(np.std(y - preds)) if len(y) > 2 else float(np.mean(y) * 0.25 + 1)
        self.mean_units = float(np.mean(y)) if len(y) else 0.0
        self.trend = growth_rate(list(df["units"].tail(90)))
        return {"rows": int(len(y)), "features": len(feature_cols)}

    def predict(self, horizon: int) -> list[dict]:
        df = self.history.copy()
        out = []
        base = df["date"].iloc[-1]
        for step in range(1, horizon + 1):
            d = base + pd.Timedelta(days=step)
            row = {c: 0.0 for c in self.feature_cols}
            for lag in (1, 2, 3, 7, 14, 30):
                col = f"lag_{lag}"
                if col in row:
                    idx = len(df) - lag
                    row[col] = float(df["units"].iloc[idx]) if idx >= 0 else self.mean_units
            for w in (7, 14, 30):
                row[f"roll_mean_{w}"] = float(df["units"].tail(w).mean())
                row[f"roll_std_{w}"] = float(df["units"].tail(w).std() if len(df) > 1 else 0)
            row["expanding_mean"] = float(df["units"].mean())
            prev = float(df["units"].iloc[-1])
            row["pct_change"] = 0.0 if prev == 0 else (self.mean_units - prev) / prev
            cal = calendar_features(d)
            # calendar features are stored flat, matching train-time names
            for k, v in cal.items():
                row[k] = v
            x = np.array([[row[c] for c in self.feature_cols]])
            pred = 0.7 * float(self.gbm.predict(x)[0]) + 0.3 * float(self.ridge.predict(x)[0])
            pred = max(0.0, pred)
            band = 1.282 * self.residual_std * math.sqrt(1 + step / 14)  # ~80% interval, widening
            out.append(
                {
                    "date": d.date().isoformat(),
                    "predictedUnits": round(pred, 1),
                    "lower": round(max(0.0, pred - band), 1),
                    "upper": round(pred + band, 1),
                }
            )
            df.loc[len(df)] = [d, pred]
        return out


# ---------------------------------------------------------------------------
# Product demand prediction (FR-25)
# ---------------------------------------------------------------------------
class DemandModel:
    """Predicts next-30-day unit demand per product from product-level calendar
    aggregated sales rows."""

    MIN_ROWS = 40

    def train(self, sales: pd.DataFrame, products: list[dict]) -> dict:
        rows = []
        prod_by_id = {p["id"]: p for p in products}
        for (date, pid), g in sales.groupby(["date", "product_id"]):
            p = prod_by_id.get(pid, {})
            cal = calendar_features(pd.Timestamp(date).to_pydatetime())
            rows.append(
                {
                    **cal,
                    "product_id": pid,
                    "units": int(g["units"].sum()),
                    "price": float(g["unit_price"].mean()),
                    "discount": float(g["discount"].sum()),
                    "margin": float(g["unit_price"].mean()) - float(g["unit_cost"].mean()),
                }
            )
        df = pd.DataFrame(rows)
        # product code mapping must be identical at train and predict time
        df["product_code"] = df["product_id"].map({p["id"]: p.get("_code", 0) for p in products})
        self.feature_cols = ["dow", "month", "is_bd_weekend", "trend", "product_code", "price", "discount", "margin"]
        X = df[self.feature_cols].values
        y = df["units"].values
        self.gbm = _regressor()
        self.gbm.fit(X, y)
        self.products = products
        # per-product recent velocity (last 30 days) used for trend labelling
        cutoff = (pd.Timestamp.now() - pd.Timedelta(days=30)).date()
        recent = sales[pd.to_datetime(sales["date"]).dt.date >= cutoff]
        self.recent_velocity = recent.groupby("product_id")["units"].sum().to_dict() if not recent.empty else {}
        older = sales[pd.to_datetime(sales["date"]).dt.date < cutoff]
        self.older_velocity = older.groupby("product_id")["units"].sum().to_dict() if not older.empty else {}
        self.days_recent = max(1, (pd.Timestamp.now().normalize() - pd.Timestamp(cutoff)).days)
        self.days_older = max(1, len(set(sales["date"])) - self.days_recent) if not sales.empty else 1
        return {"rows": int(len(df))}

    def predict(self, horizon: int = 30) -> list[dict]:
        out = []
        now = pd.Timestamp.now().to_pydatetime()
        for p in self.products:
            totals = []
            for step in range(1, horizon + 1):
                d = now + timedelta_days(step)
                cal = calendar_features(d)
                x = np.array(
                    [[
                        cal["dow"], cal["month"], cal["is_bd_weekend"], cal["trend"],
                        p.get("_code", 0), float(p.get("sellingPrice") or 0), 0.0,
                        float(p.get("sellingPrice") or 0) - float(p.get("costPrice") or 0),
                    ]]
                )
                totals.append(max(0.0, float(self.gbm.predict(x)[0])))
            predicted = float(np.sum(totals))
            recent_rate = self.recent_velocity.get(p["id"], 0) / self.days_recent
            older_rate = self.older_velocity.get(p["id"], 0) / max(self.days_older, 30)
            if recent_rate > older_rate * 1.1:
                trend = "increasing"
            elif recent_rate < older_rate * 0.9:
                trend = "decreasing"
            else:
                trend = "stable"
            out.append(
                {
                    "productId": p["id"],
                    "productName": p["name"],
                    "predictedUnits": round(predicted, 0),
                    "dailyRate": round(recent_rate, 2),
                    "trend": trend,
                }
            )
        out.sort(key=lambda r: -r["predictedUnits"])
        return out


def timedelta_days(n: int):
    from datetime import timedelta

    return timedelta(days=n)


# ---------------------------------------------------------------------------
# Return / cancellation risk (FR-26)
# ---------------------------------------------------------------------------
class RiskModel:
    MIN_ORDERS = 120
    FEATURES = [
        "is_cod", "total", "high_value", "item_count", "units", "avg_unit_price", "is_dhaka",
        "cust_orders_before", "cust_cancel_rate", "cust_return_rate", "cust_spend_before", "dow",
    ]

    def train(self, orders: pd.DataFrame) -> dict:
        df = customer_history_features(orders)
        df["dow"] = df["date"].dt.weekday
        df = df.replace([np.inf, -np.inf], 0).fillna(0)

        X = df[self.FEATURES].values
        y_cancel = df["cancelled"].values
        y_return = (df["returned"] | df["had_return"]).values  # returned order OR partial return

        self.cancel_model = _classifier()
        self.return_model = _classifier()
        self.cancel_model.fit(X, y_cancel)
        self.return_model.fit(X, y_return)
        # training AUC-ish signal via accuracy on train (demo transparency)
        return {
            "orders": int(len(df)),
            "cancelRate": float(np.mean(y_cancel)),
            "returnRate": float(np.mean(y_return)),
        }

    def predict(self, open_orders: pd.DataFrame) -> list[dict]:
        if open_orders.empty:
            return []
        df = open_orders.copy()
        df["dow"] = df["date"].dt.weekday
        df = df.replace([np.inf, -np.inf], 0).fillna(0)
        X = df[self.FEATURES].values
        p_cancel = self.cancel_model.predict_proba(X)[:, 1]
        p_return = self.return_model.predict_proba(X)[:, 1]
        out = []
        for i, (_, o) in enumerate(df.iterrows()):
            cancel_risk = round(float(p_cancel[i]) * 100, 1)
            return_risk = round(float(p_return[i]) * 100, 1)
            risk = max(cancel_risk, return_risk)
            level = "HIGH" if risk >= 60 else "MEDIUM" if risk >= 35 else "LOW"
            out.append(
                {
                    "orderId": int(o["order_id"]),
                    "orderNo": o.get("order_no"),
                    "customer": o.get("customer_name") or "",
                    "status": o["status"],
                    "total": float(o["total"]),
                    "paymentMethod": "COD" if o["is_cod"] else str(o["payment_method"]).upper(),
                    "cancellationRiskPct": cancel_risk,
                    "returnRiskPct": return_risk,
                    "riskScore": round(risk, 1),
                    "riskLevel": level,
                }
            )
        out.sort(key=lambda r: -r["riskScore"])
        return out


# ---------------------------------------------------------------------------
# Trainer cache
# ---------------------------------------------------------------------------
class ModelStore:
    """Per-business trained models with a data fingerprint + TTL."""

    def __init__(self) -> None:
        self._cache: dict[str, dict] = {}

    @staticmethod
    def fingerprint(bundle: dict) -> str:
        h = hashlib.sha1()
        h.update(str(len(bundle.get("orders", []))).encode())
        h.update(str(bundle["orders"][-1]["id"] if bundle.get("orders") else "").encode())
        h.update(str(bundle.get("business", {}) and bundle["business"].get("id")).encode())
        return h.hexdigest()[:16]

    def get(self, business_id: Any, bundle: dict, kind: str, trainer):
        key = f"{business_id}:{kind}"
        fp = self.fingerprint(bundle)
        entry = self._cache.get(key)
        if entry and entry["fp"] == fp and time.time() - entry["t"] < MODEL_TTL_SECONDS:
            return entry["model"], True
        model, meta = trainer()
        self._cache[key] = {"fp": fp, "t": time.time(), "model": model}
        return model, False


STORE = ModelStore()


def train_forecaster(bundle: dict):
    f = SalesForecaster()
    # build daily total-units series over the full history
    sales = daily_sales_frame(bundle)
    if sales.empty:
        return None, {"sufficient": False, "reason": "No completed sales yet"}
    daily = sales.groupby("date")["units"].sum()
    # fill missing days with 0 so lag features stay aligned
    full_index = pd.date_range(min(daily.index), max(daily.index), freq="D")
    daily = daily.reindex(full_index, fill_value=0)
    daily.index.name = "date"
    if len(daily) < SalesForecaster.MIN_DAYS:
        return None, {"sufficient": False, "reason": f"Need at least {SalesForecaster.MIN_DAYS} days of sales history"}
    meta = f.train(daily)
    meta["sufficient"] = True
    return f, meta


def train_demand(bundle: dict):
    sales = daily_sales_frame(bundle)
    products = bundle.get("products", [])
    if sales.empty or len(sales) < DemandModel.MIN_ROWS:
        return None, {"sufficient": False, "reason": f"Need at least {DemandModel.MIN_ROWS} product-day sales rows"}
    m = DemandModel()
    # map products to codes consistent with training
    codes = {p["id"]: i for i, p in enumerate(products)}
    for p in products:
        p["_code"] = codes[p["id"]]
    meta = m.train(sales, products)
    meta["sufficient"] = True
    return m, meta


def train_risk(bundle: dict):
    orders = orders_frame(bundle)
    if len(orders) < RiskModel.MIN_ORDERS:
        return None, {"sufficient": False, "reason": f"Need at least {RiskModel.MIN_ORDERS} orders"}
    m = RiskModel()
    meta = m.train(orders)
    meta["sufficient"] = True
    return m, meta


def open_orders_frame(bundle: dict) -> pd.DataFrame:
    rows = []
    orders = bundle.get("orders", [])
    for o in orders:
        if o.get("status") not in ("pending", "confirmed", "processing", "shipped", "out_for_delivery"):
            continue
        d = parse_date(o.get("orderDate"))
        rows.append(
            {
                "order_id": o["id"],
                "order_no": o.get("orderNo"),
                "customer_id": o.get("customerId"),
                "customer_name": o.get("customerName"),
                "city": o.get("city") or "",
                "is_dhaka": 1 if str(o.get("city") or "").lower().startswith("dhaka") else 0,
                "status": o.get("status"),
                "date": d,
                "total": float(o.get("total") or 0),
                "high_value": 1 if float(o.get("total") or 0) > 2500 else 0,
                "is_cod": 1 if o.get("paymentMethod") == "cod" else 0,
                "payment_method": o.get("paymentMethod") or "cod",
                "item_count": len(o.get("items") or []),
                "units": sum(i.get("quantity", 0) for i in o.get("items") or []),
                "avg_unit_price": (
                    float(np.mean([float(i.get("unitPrice") or 0) for i in o["items"]])) if o.get("items") else 0.0
                ),
                # customer aggregates from FULL history (risk is about propensity)
                "cust_orders_before": 0,
                "cust_cancel_rate": 0,
                "cust_return_rate": 0,
                "cust_spend_before": 0,
            }
        )
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    # fill customer aggregate features from full order history
    hist = orders_frame(bundle)
    if not hist.empty:
        agg = hist.groupby("customer_id").agg(
            orders=("order_id", "count"),
            cancel_rate=("cancelled", "mean"),
            return_rate=("returned", "mean"),
            spend=("total", "sum"),
        )
        df["cust_orders_before"] = df["customer_id"].map(agg["orders"]).fillna(0)
        df["cust_cancel_rate"] = df["customer_id"].map(agg["cancel_rate"]).fillna(0)
        df["cust_return_rate"] = df["customer_id"].map(agg["return_rate"]).fillna(0)
        df["cust_spend_before"] = df["customer_id"].map(agg["spend"]).fillna(0)
    df["dow"] = df["date"].dt.weekday
    return df
