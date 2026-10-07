"""Inventory recommendation (FR-27) and automated business insights (FR-28)."""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

from .features import daily_sales_frame, orders_frame, parse_date, growth_rate
from .models import DemandModel, train_demand


def recommend_inventory(bundle: dict, horizon: int = 30) -> dict:
    """Safety-stock reorder policy driven by predicted demand:
    cover = lead_time + safety_days; target = predicted_daily_demand * cover;
    recommendation = max(0, target + reorder_level - current_stock)."""
    sales = daily_sales_frame(bundle)
    if sales.empty:
        return {"sufficientData": False, "reason": "No sales history yet", "recommendations": []}

    model, meta = train_demand(bundle)
    settings = bundle.get("settings") or {}
    safety_days = int(settings.get("safetyStockDays", 5))

    if not meta.get("sufficient"):
        # statistical fallback: velocity-based (works with little data)
        demand_rows = None
    else:
        demand_rows = {r["productId"]: r for r in model.predict(horizon)}

    recent = sales[pd.to_datetime(sales["date"]) >= pd.Timestamp.now() - pd.Timedelta(days=30)]
    velocity = recent.groupby("product_id")["units"].sum().to_dict()
    older = sales[pd.to_datetime(sales["date"]) < pd.Timestamp.now() - pd.Timedelta(days=30)]
    older_velocity = (older.groupby("product_id")["units"].sum() / 30.0).to_dict() if not older.empty else {}

    recs = []
    for p in bundle.get("products", []):
        pid = p["id"]
        stock = int(p.get("currentStock") or 0)
        lead = int(p.get("leadTimeDays") or 7)
        reorder_level = int(p.get("reorderLevel") or 10)
        daily_velocity = velocity.get(pid, 0) / 30.0

        if demand_rows and pid in demand_rows:
            predicted_daily = demand_rows[pid]["predictedUnits"] / float(horizon)
            trend = demand_rows[pid]["trend"]
            method = "ml"
        else:
            predicted_daily = daily_velocity if daily_velocity > 0 else older_velocity.get(pid, 0)
            trend = "stable"
            method = "velocity"

        cover_days = lead + safety_days
        target_stock = predicted_daily * cover_days + reorder_level
        days_of_cover = stock / predicted_daily if predicted_daily > 0 else 999
        reorder_qty = max(0, math.ceil(target_stock - stock))

        if predicted_daily == 0:
            action = "monitor"
            priority = "low"
        elif stock <= 0:
            action, priority = "reorder", "high"
        elif days_of_cover <= lead:
            action, priority = "reorder", "high" if days_of_cover <= 3 else "medium"
        elif days_of_cover <= lead + safety_days:
            action, priority = "reorder", "medium"
        elif days_of_cover > 120:
            action, priority = "overstock", "low"
        else:
            action, priority = "monitor", "low"

        recs.append(
            {
                "productId": pid,
                "productName": p["name"],
                "currentStock": stock,
                "reorderLevel": reorder_level,
                "dailyVelocity": round(daily_velocity, 2),
                "predictedDailyDemand": round(predicted_daily, 2),
                "predictedDemand30d": round(predicted_daily * 30, 0),
                "leadTimeDays": lead,
                "daysOfCover": round(days_of_cover, 1) if days_of_cover < 999 else None,
                "recommendedPurchase": reorder_qty if action == "reorder" else 0,
                "action": action,
                "priority": priority,
                "trend": trend,
                "method": method,
            }
        )

    recs.sort(key=lambda r: (r["action"] != "reorder", r.get("daysOfCover") or 9999))
    return {
        "sufficientData": bool(meta.get("sufficient")),
        "policy": f"cover = lead time + {safety_days} safety days, plus reorder level buffer",
        "recommendations": recs,
        "summary": {
            "reorder": sum(1 for r in recs if r["action"] == "reorder"),
            "overstock": sum(1 for r in recs if r["action"] == "overstock"),
            "monitor": sum(1 for r in recs if r["action"] == "monitor"),
        },
    }


# ---------------------------------------------------------------------------
# Automated insights (FR-28)
# ---------------------------------------------------------------------------
def generate_insights(bundle: dict) -> dict:
    orders = orders_frame(bundle)
    if orders.empty:
        return {"sufficientData": False, "insights": []}

    now = pd.Timestamp.now().to_pydatetime()
    m_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_end = (m_start - pd.Timedelta(seconds=1)).to_pydatetime() if isinstance(m_start - pd.Timedelta(seconds=1), pd.Timestamp) else m_start - pd.Timedelta(seconds=1)
    last_start = last_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def period(df, a, b):
        mask = (df["date"] >= a) & (df["date"] <= b)
        return df[mask]

    cur, prev = period(orders, m_start, now), period(orders, last_start, last_end)
    if prev.empty:
        return {"sufficientData": False, "insights": [], "reason": "Need two months of history"}

    def sales_units(df):
        return float(df["units"].sum())

    def revenue(df):
        d = df[df["status"].isin(["delivered", "returned"])]
        return float((d["subtotal"] - d["discount"]).clip(lower=0).sum())

    cur_units, prev_units = sales_units(cur), sales_units(prev)
    cur_rev, prev_rev = revenue(cur), revenue(prev)

    # Month-to-date vs full previous month is an unfair comparison — normalize
    # both sides to daily averages over days elapsed.
    days_elapsed = max(1, (now - m_start).days)
    days_prev = max(1, (pd.Timestamp(last_end).normalize() - pd.Timestamp(last_start)).days)
    cur_units_cmp, prev_units_cmp = cur_units / days_elapsed, prev_units / days_prev
    cur_rev_cmp, prev_rev_cmp = cur_rev / days_elapsed, prev_rev / days_prev

    profit = bundle.get("profit") or {}
    cur_profit = float(profit.get("profit") or 0)

    insights: list[dict] = []

    def add(title, detail, category, severity="info", data=None):
        insights.append({"title": title, "detail": detail, "category": category, "severity": severity, "data": data or {}})

    # 1. Sales vs profit divergence (the SRS flagship example)
    sales_chg = pct(cur_units_cmp, prev_units_cmp)
    rev_chg = pct(cur_rev_cmp, prev_rev_cmp)
    profit_chg = profit.get("profitChangePct")
    if sales_chg is not None and profit_chg is not None:
        if sales_chg > 5 and profit_chg < sales_chg / 2:
            add(
                f"Sales grew {sales_chg:+.0f}% but profit moved only {profit_chg:+.0f}%",
                f"Revenue is up {rev_chg:+.0f}% (daily avg, month-to-date) while profit lags at {profit_chg:+.0f}%. "
                f"Return costs ৳{profit.get('returnCost', 0):,.0f} and delivery costs ৳{profit.get('deliveryCost', 0):,.0f} "
                f"are eating into margin (current margin {profit.get('margin', 0):.1f}%). "
                "Review high-risk COD orders and courier charges by product.",
                "profitability", "warning",
                {"salesChangePct": sales_chg, "profitChangePct": profit_chg, "margin": profit.get("margin")},
            )
        elif sales_chg < -5:
            add(
                f"Sales decreased {abs(sales_chg):.0f}% vs last month (daily average)",
                f"Units/day dropped from {prev_units_cmp:.1f} to {cur_units_cmp:.1f} this month-to-date. "
                "Check stock-outs on top sellers and recent promotion activity.",
                "sales", "warning", {"salesChangePct": sales_chg},
            )
        else:
            add(
                f"Sales {sales_chg:+.0f}%, profit {profit_chg:+.0f}%",
                f"Units {prev_units:.0f} → {cur_units:.0f}, revenue ৳{prev_rev:,.0f} → ৳{cur_rev:,.0f}. Margin at {profit.get('margin', 0):.1f}%.",
                "sales", "info", {"salesChangePct": sales_chg, "profitChangePct": profit_chg},
            )

    # 2. Return pressure
    cur_ret = float(cur["returned"].sum() + cur["had_return"].sum())
    prev_ret = float(prev["returned"].sum() + prev["had_return"].sum())
    cur_rate = cur_ret / max(len(cur), 1)
    prev_rate = prev_ret / max(len(prev), 1)
    if cur_rate > prev_rate + 0.02:
        add(
            "Return rate is rising",
            f"Return rate {prev_rate * 100:.1f}% → {cur_rate * 100:.1f}%. "
            "Consider confirmation calls before dispatch and clearer size charts on high-return products.",
            "returns", "warning" if cur_rate > 0.15 else "info",
            {"prevRate": round(prev_rate * 100, 1), "curRate": round(cur_rate * 100, 1)},
        )

    # 3. Cancellation pressure
    cur_cancel = float(cur["cancelled"].mean() or 0)
    prev_cancel = float(prev["cancelled"].mean() or 0)
    if cur_cancel > prev_cancel + 0.02:
        add(
            "Order cancellations increased",
            f"{prev_cancel * 100:.1f}% → {cur_cancel * 100:.1f}% of orders cancelled. "
            "Confirmation calls on COD orders above ৳2,500 typically recover 30–50% of them.",
            "cancellations", "warning" if cur_cancel > 0.12 else "info",
            {"prevRate": round(prev_cancel * 100, 1), "curRate": round(cur_cancel * 100, 1)},
        )

    # 4. COD concentration
    cod_share = float(cur["is_cod"].mean() or 0)
    if cod_share > 0.7:
        add(
            f"{cod_share * 100:.0f}% of orders are Cash on Delivery",
            "COD carries the highest cancellation/return exposure. Encourage bKash/Nagad prepayment "
            "with a small discount for repeat customers.",
            "payments", "info", {"codShare": round(cod_share * 100, 1)},
        )

    # 5. Discount pressure
    cur_disc = float(cur["discount"].sum() / max(cur["subtotal"].sum(), 1))
    prev_disc = float(prev["discount"].sum() / max(prev["subtotal"].sum(), 1))
    if cur_disc > prev_disc + 0.02:
        add(
            "Discount usage is climbing",
            f"Discount share {prev_disc * 100:.1f}% → {cur_disc * 100:.1f}% of order value. "
            "Watch margin on discounted lines.",
            "pricing", "info", {"prevRate": round(prev_disc * 100, 1), "curRate": round(cur_disc * 100, 1)},
        )

    # 6. Growth trend (3-month)
    recent_series = bundle.get("monthlySeries", [])[-4:]
    if len(recent_series) >= 3:
        g = growth_rate([m["units"] for m in recent_series])
        if g > 0.05:
            add("Business is on a growth streak", f"Average month-over-month unit growth {g * 100:+.1f}% over the last 3 months. Plan inventory ahead of the curve.", "growth", "positive")
        elif g < -0.05:
            add("Sales trend is softening", f"Average month-over-month unit change {g * 100:+.1f}% over the last 3 months. Consider promotions on best sellers.", "growth", "warning")

    severities = {"warning": 0, "positive": 1, "info": 2}
    insights.sort(key=lambda i: severities.get(i["severity"], 3))
    return {"sufficientData": True, "periodStart": m_start.date().isoformat(), "insights": insights}


def pct(cur: float, prev: float):
    if prev is None or prev == 0:
        return None if cur == 0 else 100.0
    return round((cur - prev) / prev * 100, 1)
