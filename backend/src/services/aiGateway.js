const axios = require('axios');
const env = require('../config/env');
const { Op } = require('sequelize');
const {
  Order, OrderItem, Customer, Payment, Product, Inventory,
  ReturnRecord, Cancellation, AIPrediction, AIRecommendation, Business,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const analytics = require('./analyticsService');

const http = axios.create({ baseURL: env.AI_SERVICE_URL, timeout: 60000 });

async function callAI(path, payload) {
  try {
    const { data } = await http.post(path, payload);
    return data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.response === undefined) {
      throw new ApiError(503, 'AI service is unavailable. Start the Python AI service (ai-service/).');
    }
    const detail = err.response && err.response.data && err.response.data.detail;
    throw new ApiError(err.response?.status || 500, typeof detail === 'string' ? detail : 'AI service error');
  }
}

async function logPrediction(businessId, type, payload, result, userId) {
  await AIPrediction.create({
    businessId, type, payload,
    modelInfo: result && result.model ? result.model : null,
    requestedBy: userId || null,
  });
  return result;
}

/**
 * Gather the data bundle every AI endpoint needs from the relational DB.
 * This is the "Analytics + AI/ML" pipeline input described in SRS section 5.
 */
async function buildDataBundle(businessId) {
  const business = await Business.findByPk(businessId);
  const orders = await Order.findAll({
    where: { businessId },
    include: [
      { model: Customer },
      { model: OrderItem, as: 'items' },
      { model: Payment },
      { model: ReturnRecord },
      { model: Cancellation },
    ],
    order: [['orderDate', 'ASC']],
  });
  const products = await Product.findAll({
    where: { businessId, isActive: true },
    include: [{ model: Inventory, required: false }],
  });

  const customers = await Customer.findAll({ where: { businessId } });
  const monthly = await analytics.monthlySeries(businessId, 12);
  const daily = await analytics.dailySeries(businessId, 60);
  const profit = await analytics.profitAnalysis(businessId, 'month');
  const priorProfit = await analytics.profitAnalysis(businessId, 'last_61_days'); // approximate previous period for insight deltas

  return {
    business: business ? { id: business.id, name: business.name, currency: business.currency, settings: business.settings } : null,
    currency: business ? business.currency : 'BDT',
    orders: orders.map((o) => ({
      id: o.id, orderNo: o.orderNo, customerId: o.customerId,
      customerName: o.Customer ? o.Customer.name : null,
      customerPhone: o.Customer ? o.Customer.phone : null,
      city: o.Customer ? o.Customer.city : null,
      status: o.status, orderDate: o.orderDate,
      subtotal: Number(o.subtotal), discount: Number(o.discount || 0),
      deliveryCharge: Number(o.deliveryCharge || 0), total: Number(o.total),
      paymentMethod: o.paymentMethod, placedVia: o.placedVia,
      deliveredAt: o.deliveredAt, cancelledAt: o.cancelledAt, returnedAt: o.returnedAt,
      courierCharge: o.Payments && o.Payments[0] ? Number(o.Payments[0].courierCharge || 0) : 0,
      items: o.items.map((it) => ({
        productId: it.productId, productName: it.productName,
        quantity: it.quantity, unitPrice: Number(it.unitPrice), unitCost: Number(it.unitCost),
      })),
      returnReasons: (o.ReturnRecords || []).map((r) => ({ productId: r.productId, quantity: r.quantity, reason: r.reason, condition: r.condition })),
      cancellationReason: o.Cancellation ? o.Cancellation.reason : null,
    })),
    products: products.map((p) => ({
      id: p.id, name: p.name, sku: p.sku, categoryId: p.categoryId,
      sellingPrice: Number(p.sellingPrice), costPrice: Number(p.costPrice),
      reorderLevel: p.reorderLevel, leadTimeDays: p.leadTimeDays,
      currentStock: p.Inventory ? p.Inventory.currentStock : 0,
    })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, city: c.city })),
    monthlySeries: monthly,
    dailySeries: daily,
    profit,
    settings: business ? business.settings : {},
  };
}

// ---- FR-24: sales forecast ----
async function salesForecast(businessId, userId, horizonDays = 30) {
  const bundle = await buildDataBundle(businessId);
  const result = await callAI('/api/forecast/sales', { ...bundle, horizon_days: horizonDays });
  await logPrediction(businessId, 'sales_forecast', { horizonDays }, result, userId);
  return result;
}

// ---- FR-25: demand prediction ----
async function demandPrediction(businessId, userId, productId = null) {
  const bundle = await buildDataBundle(businessId);
  const result = await callAI('/api/predict/demand', { ...bundle, product_id: productId });
  await logPrediction(businessId, 'demand_prediction', { productId }, result, userId);
  return result;
}

// ---- FR-26: return/cancellation risk for open orders ----
async function riskPrediction(businessId, userId, orderId = null) {
  const bundle = await buildDataBundle(businessId);
  const result = await callAI('/api/predict/risk', { ...bundle, order_id: orderId });
  await logPrediction(businessId, 'risk_prediction', { orderId }, result, userId);

  // Cache scores on open orders so the order list can flag risk without re-scoring.
  if (result && Array.isArray(result.orders)) {
    for (const r of result.orders) {
      if (orderId && r.orderId !== orderId) continue;
      const risk = Math.max(r.cancellationRiskPct || 0, r.returnRiskPct || 0);
      await Order.update(
        { riskScore: risk, riskLevel: r.riskLevel },
        { where: { id: r.orderId, businessId } }
      );
    }
  }
  return result;
}

// ---- FR-27: inventory recommendations ----
async function inventoryRecommendations(businessId, userId) {
  const bundle = await buildDataBundle(businessId);
  const result = await callAI('/api/recommend/inventory', bundle);
  await logPrediction(businessId, 'inventory_recommendation', {}, result, userId);

  // Persist as actionable recommendations (AI_Recommendations entity).
  if (result && result.sufficientData && Array.isArray(result.recommendations)) {
    await AIRecommendation.destroy({ where: { businessId, type: 'restock' } });
    for (const r of result.recommendations) {
      if (r.action === 'reorder') {
        await AIRecommendation.create({
          businessId, productId: r.productId, type: 'restock',
          title: `Restock ${r.productName}`,
          detail: r,
          priority: r.daysOfCover <= 3 ? 'high' : r.daysOfCover <= 7 ? 'medium' : 'low',
        });
      }
    }
  }
  return result;
}

// ---- FR-28: automated business insights ----
async function businessInsights(businessId, userId) {
  const bundle = await buildDataBundle(businessId);
  const result = await callAI('/api/insights', bundle);
  await logPrediction(businessId, 'insight', {}, result, userId);
  return result;
}

// ---- FR-29: natural-language business assistant ----
async function assistantAsk(businessId, userId, question) {
  const bundle = await buildDataBundle(businessId);
  const result = await callAI('/api/assistant', { ...bundle, question });
  await logPrediction(businessId, 'insight', { question }, result, userId);
  return result;
}

module.exports = { salesForecast, demandPrediction, riskPrediction, inventoryRecommendations, businessInsights, assistantAsk, buildDataBundle, callAI };
