const { Business, Expense, Notification, AIRecommendation, ReturnRecord, Cancellation, AIPrediction } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const analytics = require('../services/analyticsService');
const ai = require('../services/aiGateway');

// ---------------- Analytics (FR-20..23) ----------------
async function getDashboard(req, res, next) {
  try { res.json({ success: true, dashboard: await analytics.dashboard(req.user.businessId) }); }
  catch (err) { next(err); }
}

async function getSales(req, res, next) {
  try {
    const period = req.query.period || 'month';
    res.json({ success: true, summary: await analytics.salesSummary(req.user.businessId, period) });
  } catch (err) { next(err); }
}

// BR-04: financial reports restricted to owner/admin.
async function getProfit(req, res, next) {
  try {
    const period = req.query.period || 'month';
    res.json({ success: true, profit: await analytics.profitAnalysis(req.user.businessId, period) });
  } catch (err) { next(err); }
}

async function getProductPerformance(req, res, next) {
  try { res.json({ success: true, products: await analytics.productPerformance(req.user.businessId, req.query.period || 'month') }); }
  catch (err) { next(err); }
}

async function getSeries(req, res, next) {
  try {
    const granularity = req.query.granularity || 'daily';
    const series = granularity === 'monthly'
      ? await analytics.monthlySeries(req.user.businessId, parseInt(req.query.months || '12', 10))
      : await analytics.dailySeries(req.user.businessId, parseInt(req.query.days || '30', 10));
    res.json({ success: true, series });
  } catch (err) { next(err); }
}

// ---------------- AI endpoints (SRS 25.2) ----------------
async function getSalesForecast(req, res, next) {
  try { res.json({ success: true, forecast: await ai.salesForecast(req.user.businessId, req.user.id, parseInt(req.query.days || '30', 10)) }); }
  catch (err) { next(err); }
}

async function getDemandPrediction(req, res, next) {
  try { res.json({ success: true, prediction: await ai.demandPrediction(req.user.businessId, req.user.id, req.query.productId ? Number(req.query.productId) : null) }); }
  catch (err) { next(err); }
}

async function getRiskPrediction(req, res, next) {
  try { res.json({ success: true, risk: await ai.riskPrediction(req.user.businessId, req.user.id, req.query.orderId ? Number(req.query.orderId) : null) }); }
  catch (err) { next(err); }
}

async function getRecommendations(req, res, next) {
  try { res.json({ success: true, recommendations: await ai.inventoryRecommendations(req.user.businessId, req.user.id) }); }
  catch (err) { next(err); }
}

async function getInsights(req, res, next) {
  try { res.json({ success: true, insights: await ai.businessInsights(req.user.businessId, req.user.id) }); }
  catch (err) { next(err); }
}

async function askAssistant(req, res, next) {
  try {
    if (!req.body.question || !req.body.question.trim()) throw new ApiError(400, 'question is required');
    const result = await ai.assistantAsk(req.user.businessId, req.user.id, req.body.question.trim());
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function listAiRecommendations(req, res) {
  const rows = await AIRecommendation.findAll({
    where: { businessId: req.user.businessId }, order: [['id', 'DESC']], limit: 50,
  });
  res.json({ success: true, recommendations: rows });
}

async function markRecommendation(req, res, next) {
  try {
    const rec = await AIRecommendation.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!rec) throw new ApiError(404, 'Recommendation not found');
    rec.status = req.body.status || 'viewed';
    await rec.save();
    res.json({ success: true, recommendation: rec });
  } catch (err) { next(err); }
}

// ---------------- Business profile (FR-04) ----------------
async function getBusiness(req, res) {
  const business = await Business.findByPk(req.user.businessId);
  res.json({ success: true, business });
}

async function updateBusiness(req, res, next) {
  try {
    const business = await Business.findByPk(req.user.businessId);
    if (!business) throw new ApiError(404, 'Business not found');
    delete req.body.id;
    await business.update(req.body);
    res.json({ success: true, business });
  } catch (err) { next(err); }
}

// ---------------- Expenses (feeds FR-22) ----------------
async function listExpenses(req, res) {
  const expenses = await Expense.findAll({ where: { businessId: req.user.businessId }, order: [['expenseDate', 'DESC']], limit: 200 });
  res.json({ success: true, expenses });
}

async function createExpense(req, res, next) {
  try {
    const expense = await Expense.create({ businessId: req.user.businessId, ...req.body });
    res.status(201).json({ success: true, expense });
  } catch (err) { next(err); }
}

async function deleteExpense(req, res, next) {
  try {
    const expense = await Expense.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!expense) throw new ApiError(404, 'Expense not found');
    await expense.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ---------------- Notifications (FR-09) ----------------
async function listNotifications(req, res) {
  const notifications = await Notification.findAll({
    where: { businessId: req.user.businessId }, order: [['id', 'DESC']], limit: 50,
  });
  const unread = notifications.filter((n) => !n.isRead).length;
  res.json({ success: true, notifications, unread });
}

async function markNotificationsRead(req, res) {
  await Notification.update({ isRead: true }, { where: { businessId: req.user.businessId } });
  res.json({ success: true });
}

// ---------------- Returns & cancellations listing ----------------
async function listReturns(req, res) {
  const { ReturnRecord: RR, Order, Product } = require('../models');
  const returns = await RR.findAll({
    where: { businessId: req.user.businessId },
    include: [{ model: Order, attributes: ['orderNo', 'status'] }, { model: Product, attributes: ['name'] }],
    order: [['returnDate', 'DESC']], limit: 200,
  });
  res.json({ success: true, returns });
}

async function listCancellations(req, res) {
  const cancellations = await Cancellation.findAll({
    where: { businessId: req.user.businessId },
    order: [['cancelledOn', 'DESC']], limit: 200,
  });
  const byReason = {};
  for (const c of cancellations) byReason[c.reason] = (byReason[c.reason] || 0) + 1;
  res.json({ success: true, cancellations, byReason });
}

module.exports = {
  getDashboard, getSales, getProfit, getProductPerformance, getSeries,
  getSalesForecast, getDemandPrediction, getRiskPrediction, getRecommendations,
  getInsights, askAssistant, listAiRecommendations, markRecommendation,
  getBusiness, updateBusiness, listExpenses, createExpense, deleteExpense,
  listNotifications, markNotificationsRead, listReturns, listCancellations,
};
