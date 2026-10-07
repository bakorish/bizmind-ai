"""Natural-language business assistant (FR-29).

Deterministic intent matching over the data bundle — no external LLM needed, so
answers are always grounded in the business's real numbers (auditable for the
academic demo) and the service runs fully offline.
"""
from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

from .features import daily_sales_frame, orders_frame, parse_date
from .models import open_orders_frame, train_risk, train_forecaster

INTENTS = [
    ("best_sellers", ["best", "top", "selling", "popular", "bestsell", "best-sell"]),
    ("worst_products", ["worst", "declining", "less popular", "slow", "unpopular", "losing"]),
    ("profit_question", ["profit", "margin", "earning", "why.*decrease", "losing money"]),
    ("stock_out", ["run out", "stock out", "stockout", "out of stock", "finish", "shortage", "inventory.*buy", "purchase", "restock"]),
    ("forecast", ["forecast", "predict", "next month", "next week", "expect", "future", "upcoming"]),
    ("promote", ["promote", "marketing", "campaign", "advertise", "boost", "discount"]),
    ("returns", ["return", "refund"]),
    ("cancellations", ["cancel", "cancellation"]),
    ("customers", ["customer", "buyer", "client"]),
    ("revenue_summary", ["revenue", "sales", "income", "how much", "earn", "total", "doing"]),
    ("risk_orders", ["risk", "risky", "cancel.*chance", "dangerous"]),
]


def detect_intent(question: str) -> str:
    q = question.lower()
    for intent, patterns in INTENTS:
        for pat in patterns:
            if re.search(pat, q):
                return intent
    return "revenue_summary"


def _money(v: float, currency: str = "৳") -> str:
    return f"{currency}{v:,.0f}"


def answer_question(bundle: dict, question: str) -> dict:
    intent = detect_intent(question)
    currency = "৳"
    orders = orders_frame(bundle)
    sales = daily_sales_frame(bundle)

    # monthly buckets of completed orders
    done = orders[orders["status"].isin(["delivered", "returned"])] if not orders.empty else orders

    def month_units_rev(df):
        if df.empty:
            return 0.0, 0.0
        return float(df["units"].sum()), float((df["subtotal"] - df["discount"]).clip(lower=0).sum())

    this_month = done[done["date"] >= pd.Timestamp.now().to_period("M").start_time] if not done.empty else done
    units, revenue = month_units_rev(this_month)

    answer, data, followups = "", {}, []

    if intent == "best_sellers":
        top = sales.groupby("product_name").agg(units=("units", "sum"), revenue=("revenue", "sum")).sort_values("revenue", ascending=False).head(5)
        lines = [f"• {n}: {int(r.units)} units, {_money(r.revenue, currency)}" for n, r in top.iterrows()]
        answer = f"Your top sellers by revenue:\n" + "\n".join(lines)
        data = {"topProducts": [{"name": n, "units": int(r.units), "revenue": round(r.revenue)} for n, r in top.iterrows()]}
        followups = ["Which products are declining?", "What should I promote?"]

    elif intent == "worst_products":
        prod = sales.groupby("product_name").agg(units=("units", "sum"), revenue=("revenue", "sum"))
        returns_by_product: dict[str, int] = {}
        for o in bundle.get("orders", []):
            for rr in o.get("returnReasons") or []:
                name = next((i.get("productName") for i in o.get("items", []) if i.get("productId") == rr.get("productId")), None)
                if name:
                    returns_by_product[name] = returns_by_product.get(name, 0) + rr.get("quantity", 0)
        prod["returns"] = pd.Series(returns_by_product).reindex(prod.index).fillna(0)
        prod["returnRate"] = prod["returns"] / prod["units"].clip(lower=1) * 100
        worst = prod.sort_values("returnRate", ascending=False).head(5)
        lines = [f"• {n}: {r.returnRate:.0f}% return rate ({int(r.returns)} of {int(r.units)} units)" for n, r in worst.iterrows()]
        answer = "Products losing you money (highest return rates):\n" + "\n".join(lines) + "\n\nConsider improving size charts, photos, or re-checking quality."
        data = {"worstProducts": [{"name": n, "returnRatePct": round(r.returnRate, 1)} for n, r in worst.iterrows()]}
        followups = ["Why are returns increasing?", "Show sales forecast"]

    elif intent == "profit_question":
        p = bundle.get("profit") or {}
        chg = p.get("profitChangePct")
        answer = (
            f"This month: revenue {_money(p.get('revenue', 0), currency)}, profit {_money(p.get('profit', 0), currency)} "
            f"(margin {p.get('margin', 0):.1f}%, {chg:+.0f}% vs previous period).\n"
            f"Costs this period: product {_money(p.get('productCost', 0), currency)}, delivery {_money(p.get('deliveryCost', 0), currency)}, "
            f"returns {_money(p.get('returnCost', 0), currency)}, other expenses {_money(p.get('otherExpenses', 0), currency)}."
        )
        if chg is not None and chg < 0:
            drivers = []
            if p.get("returnCost", 0) > p.get("revenue", 1) * 0.02:
                drivers.append(f"return costs {_money(p.get('returnCost', 0), currency)}")
            if p.get("deliveryCost", 0) > p.get("revenue", 1) * 0.03:
                drivers.append(f"delivery costs {_money(p.get('deliveryCost', 0), currency)}")
            if p.get("otherExpenses", 0) > p.get("revenue", 1) * 0.03:
                drivers.append(f"expenses {_money(p.get('otherExpenses', 0), currency)}")
            if drivers:
                answer += "\nMain pressure points: " + ", ".join(drivers) + ". Reducing these protects margin fastest."
        elif chg is not None and chg > 0:
            answer += "\nProfit is trending up — keep the current product mix and ad spend."
        data = {"profit": p}
        followups = ["Which products have the best margin?", "Show inventory recommendations"]

    elif intent == "stock_out":
        from .recommender import recommend_inventory

        rec = recommend_inventory(bundle)
        urgent = [r for r in rec["recommendations"] if r["action"] == "reorder"][:5]
        if not urgent:
            answer = "Good news — no product is projected to run out in the next 2 weeks at current velocity."
        else:
            lines = [
                f"• {r['productName']}: {r['daysOfCover']} days of cover left — buy {r['recommendedPurchase']} units"
                for r in urgent
            ]
            answer = "Products likely to run out of stock:\n" + "\n".join(lines)
        data = {"urgent": urgent}
        followups = ["Show full inventory recommendations", "What's my sales forecast?"]

    elif intent == "forecast":
        model, meta = train_forecaster(bundle)
        if not meta.get("sufficient"):
            answer = f"I can't forecast yet: {meta.get('reason')}."
        else:
            days = 7 if re.search(r"week", question.lower()) else 30
            preds = model.predict(days)
            total = sum(p["predictedUnits"] for p in preds)
            avg_day = total / days
            answer = (
                f"Forecast for the next {days} days: ~{total:.0f} units sold "
                f"(~{avg_day:.0f}/day, range {sum(p['lower'] for p in preds):.0f}–{sum(p['upper'] for p in preds):.0f})."
            )
            data = {"forecastDays": days, "predictedUnits": round(total), "series": preds}
        followups = ["What should I promote?", "Which products will run out?"]

    elif intent == "promote":
        sales30 = sales[pd.to_datetime(sales["date"]) >= pd.Timestamp.now() - pd.Timedelta(days=30)]
        by_prod = sales30.groupby("product_name").agg(units=("units", "sum"), revenue=("revenue", "sum"))
        products = {p["name"]: p for p in bundle.get("products", [])}
        scored = []
        for name, row in by_prod.iterrows():
            p = products.get(name, {})
            margin_pct = (float(p.get("sellingPrice") or 0) - float(p.get("costPrice") or 0)) / max(float(p.get("sellingPrice") or 1), 1)
            stock = int(p.get("currentStock") or 0)
            score = row["units"] * margin_pct * (1.5 if stock > 20 else 0.5 if stock < 5 else 1)
            scored.append({"name": name, "score": score, "units": int(row["units"]), "marginPct": round(margin_pct * 100, 1), "stock": stock})
        scored.sort(key=lambda x: -x["score"])
        top = scored[:3]
        lines = [f"• {s['name']}: {s['units']} sold/30d, {s['marginPct']}% margin, {s['stock']} in stock" for s in top]
        answer = "Best promotion candidates (high demand × healthy margin × enough stock):\n" + "\n".join(lines)
        data = {"candidates": top}
        followups = ["Show sales forecast", "Which products are declining?"]

    elif intent == "returns":
        total_returns = int(done["returned"].sum() + done["had_return"].sum()) if not done.empty else 0
        rate = total_returns / max(len(done), 1) * 100
        reasons: dict[str, int] = {}
        for o in bundle.get("orders", []):
            for rr in o.get("returnReasons") or []:
                reasons[rr.get("reason", "other")] = reasons.get(rr.get("reason", "other"), 0) + rr.get("quantity", 0)
        top_reasons = sorted(reasons.items(), key=lambda kv: -kv[1])[:3]
        lines = [f"• {r.replace('_', ' ')}: {c} units" for r, c in top_reasons]
        answer = f"Return rate: {rate:.1f}% of completed orders ({total_returns} returns).\nTop reasons:\n" + "\n".join(lines)
        data = {"returnRatePct": round(rate, 1), "reasons": dict(top_reasons)}
        followups = ["Which products have the highest return rate?", "Why did my profit decrease?"]

    elif intent == "cancellations":
        cancels = orders[orders["cancelled"] == 1] if not orders.empty else orders
        rate = len(cancels) / max(len(orders), 1) * 100
        cod_rate = cancels["is_cod"].mean() * 100 if not cancels.empty else 0
        answer = (
            f"Cancellation rate: {rate:.1f}% of all orders ({len(cancels)} cancellations). "
            f"{cod_rate:.0f}% of cancelled orders were COD. "
            "High-value COD orders are the biggest exposure — a confirmation call before dispatch usually recovers a third of them."
        )
        data = {"cancellationRatePct": round(rate, 1), "codShareOfCancelsPct": round(cod_rate)}
        followups = ["Which open orders are risky?", "Show sales forecast"]

    elif intent == "customers":
        if done.empty:
            answer = "No customer data yet."
        else:
            top = done.groupby("customer_id").agg(units=("units", "sum"), spend=("total", "sum")).sort_values("spend", ascending=False).head(5)
            names = {c["id"]: c["name"] for c in bundle.get("customers", [])}
            lines = [f"• {names.get(cid, f'Customer #{cid}')}: {_money(spend, currency)} across {int(row.units)} units" for cid, row in top.iterrows()]
            answer = f"You have {len(bundle.get('customers', []))} customers. Top by lifetime spend:\n" + "\n".join(lines)
        followups = ["What should I promote?", "Show sales forecast"]

    elif intent == "risk_orders":
        model, meta = train_risk(bundle)
        open_df = open_orders_frame(bundle)
        if not meta.get("sufficient") or open_df.empty:
            answer = "Risk scoring needs more order history (or there are no open orders right now)."
        else:
            scored = model.predict(open_df)
            high = [r for r in scored if r["riskLevel"] == "HIGH"][:5]
            if not high:
                answer = "No open order currently crosses the HIGH risk threshold. 🎉"
            else:
                lines = [f"• {r['orderNo']} ({_money(r['total'], currency)}, {r['paymentMethod']}): {r['riskScore']:.0f}% risk — {r['cancellationRiskPct']:.0f}% cancel / {r['returnRiskPct']:.0f}% return" for r in high]
                answer = "Open orders with HIGH risk:\n" + "\n".join(lines) + "\nRecommended: call these customers to confirm before dispatch."
        data = {"highRiskCount": len([r for r in (model.predict(open_df) if meta.get("sufficient") and not open_df.empty else []) if r["riskLevel"] == "HIGH"])}
        followups = ["Why are cancellations increasing?", "Show best sellers"]

    else:  # revenue_summary
        answer = (
            f"This month so far: {units:.0f} units sold, revenue {_money(revenue, currency)} from {len(this_month)} completed orders. "
            f"Average order value {_money(revenue / max(len(this_month), 1), currency)}."
        )
        followups = ["Why did my profit decrease?", "What are my best sellers?", "Show sales forecast"]

    return {
        "intent": intent,
        "question": question,
        "answer": answer,
        "data": data,
        "suggestedFollowups": followups,
        "disclaimer": "Answers are computed from your business data. Predictions are estimates, not guarantees.",
    }
