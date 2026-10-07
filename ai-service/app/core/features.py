"""Feature engineering: turn the backend's data bundle into ML-ready frames.

The bundle (built by backend/src/services/aiGateway.js) contains orders,
products, customers, monthly/daily series, and profit metrics. Everything here
is deterministic so results are reproducible for the demo/defense.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd

# Statuses that mean "completed sale" for revenue/units purposes.
DONE = {"delivered", "returned"}


def parse_date(v: Any) -> datetime | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.replace(tzinfo=None) if v.tzinfo else v
    try:
        ts = pd.to_datetime(v)
        if ts.tzinfo is not None:  # backend sends ISO-UTC; normalize to naive
            ts = ts.tz_localize(None)
        return ts.to_pydatetime()
    except Exception:
        return None


def orders_frame(bundle: dict) -> pd.DataFrame:
    rows = []
    for o in bundle.get("orders", []):
        d = parse_date(o.get("orderDate"))
        total = float(o.get("total") or 0)
        rows.append(
            {
                "order_id": o["id"],
                "order_no": o.get("orderNo"),
                "customer_id": o.get("customerId"),
                "city": o.get("city") or "",
                "is_dhaka": 1 if str(o.get("city") or "").lower().startswith("dhaka") else 0,
                "status": o.get("status"),
                "date": d,
                "subtotal": float(o.get("subtotal") or 0),
                "discount": float(o.get("discount") or 0),
                "total": total,
                "high_value": 1 if total > 2500 else 0,
                "is_cod": 1 if o.get("paymentMethod") == "cod" else 0,
                "payment_method": o.get("paymentMethod") or "cod",
                "item_count": len(o.get("items") or []),
                "units": sum(i.get("quantity", 0) for i in o.get("items") or []),
                "avg_unit_price": (
                    float(np.mean([float(i.get("unitPrice") or 0) for i in o["items"]])) if o.get("items") else 0.0
                ),
                "cancelled": 1 if o.get("status") == "cancelled" else 0,
                "returned": 1 if o.get("status") == "returned" else 0,
                "had_return": 1 if (o.get("returnReasons") or []) else 0,
                "delivered": 1 if o.get("status") == "delivered" else 0,
            }
        )
    df = pd.DataFrame(rows)
    if not df.empty:
        df = df.sort_values("date").reset_index(drop=True)
    return df


def daily_sales_frame(bundle: dict) -> pd.DataFrame:
    """Daily units/revenue from DELIVERED orders (returned orders still count as
    initially-sold; returns are handled separately in insights)."""
    rows = []
    for o in bundle.get("orders", []):
        d = parse_date(o.get("orderDate"))
        if d is None or o.get("status") not in DONE:
            continue
        for it in o.get("items", []):
            rows.append(
                {
                    "date": d.date(),
                    "product_id": it["productId"],
                    "product_name": it.get("productName"),
                    "units": int(it.get("quantity") or 0),
                    "revenue": float(it.get("unitPrice") or 0) * int(it.get("quantity") or 0),
                    "unit_cost": float(it.get("unitCost") or 0),
                    "unit_price": float(it.get("unitPrice") or 0),
                    "discount": float(o.get("discount") or 0) / max(len(o.get("items") or []), 1),
                }
            )
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    return df.groupby(["date", "product_id", "product_name"], as_index=False).agg(
        {"units": "sum", "revenue": "sum", "unit_cost": "mean", "unit_price": "mean", "discount": "sum"}
    )


def calendar_features(d: datetime) -> dict:
    return {
        "dow": d.weekday(),
        "dom": d.day,
        "month": d.month,
        "doy": d.timetuple().tm_yday,
        "is_weekend": 1 if d.weekday() >= 5 else 0,
        # Bangladesh weekend effect: Friday/Saturday busy days for online shopping.
        "is_bd_weekend": 1 if d.weekday() in (4, 5) else 0,
        "trend": (d - datetime(2024, 1, 1)).days,
    }


def enrich_series_features(df: pd.DataFrame, value_col: str, lags=(1, 2, 3, 7, 14, 30), windows=(7, 14, 30)) -> pd.DataFrame:
    """Lag + rolling-mean features for a date-indexed series."""
    df = df.sort_values("date").copy()
    s = df[value_col].astype(float)
    for lag in lags:
        df[f"lag_{lag}"] = s.shift(lag)
    for w in windows:
        df[f"roll_mean_{w}"] = s.shift(1).rolling(w, min_periods=1).mean()
        df[f"roll_std_{w}"] = s.shift(1).rolling(w, min_periods=1).std().fillna(0)
    # expanding mean captures the level; pct change captures momentum
    df["expanding_mean"] = s.shift(1).expanding(min_periods=1).mean()
    prev = s.shift(1)
    df["pct_change"] = np.where(prev != 0, (s - prev) / prev.replace(0, np.nan), 0)
    df["pct_change"] = df["pct_change"].replace([np.inf, -np.inf], 0).fillna(0)
    return df


def customer_history_features(orders: pd.DataFrame) -> pd.DataFrame:
    """Per-order customer aggregates computed strictly from PRIOR orders
    (expanding window) — avoids target leakage for the risk model."""
    if orders.empty:
        return orders
    df = orders.sort_values("date").copy()
    df["cust_orders_before"] = df.groupby("customer_id").cumcount()
    df["cust_cancel_before"] = (
        df.groupby("customer_id")["cancelled"].expanding().sum().reset_index(level=0, drop=True)
        - df["cancelled"]
    )
    df["cust_return_before"] = (
        df.groupby("customer_id")["returned"].expanding().sum().reset_index(level=0, drop=True)
        - df["returned"]
    )
    df["cust_cancel_rate"] = (df["cust_cancel_before"] / df["cust_orders_before"].clip(lower=1)).fillna(0)
    df["cust_return_rate"] = (df["cust_return_before"] / df["cust_orders_before"].clip(lower=1)).fillna(0)
    df["cust_spend_before"] = (
        df.groupby("customer_id")["total"].expanding().sum().reset_index(level=0, drop=True) - df["total"]
    ).fillna(0)
    return df


def growth_rate(series: list[float]) -> float:
    """Simple average period-over-period growth, robust to zeros."""
    vals = [v for v in series if v is not None]
    if len(vals) < 2:
        return 0.0
    ratios = []
    for a, b in zip(vals, vals[1:]):
        if a > 0 and b > 0:
            ratios.append(b / a - 1)
        elif b > 0:
            ratios.append(0.05)
    return float(np.mean(ratios)) if ratios else 0.0
