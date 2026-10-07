const { Op, fn, col, literal } = require('sequelize');
const { Order, OrderItem, Customer, Payment, ReturnRecord, Expense, Product } = require('../models');
const { computeProfit } = require('../utils/profit');

function periodRange(period, ref = new Date()) {
  // period: today | week | month | quarter | year | last_N_days | all
  const to = new Date(ref); to.setHours(23, 59, 59, 999);
  const from = new Date(ref); from.setHours(0, 0, 0, 0);
  if (period === 'today') { /* from is already start of day */ }
  else if (period === 'week') from.setDate(from.getDate() - 6);
  else if (period === 'month') from.setMonth(from.getMonth() - 1);
  else if (period === 'quarter') from.setMonth(from.getMonth() - 3);
  else if (period === 'year') from.setFullYear(from.getFullYear() - 1);
  else if (/^last_(\d+)_days$/.test(period)) from.setDate(from.getDate() - (parseInt(period.match(/^last_(\d+)_days$/)[1], 10) - 1));
  else if (period === 'all' || !period) return null;
  else throw Object.assign(new Error(`Unknown period '${period}'`), { status: 400 });
  return { from, to };
}

function priorRange({ from, to }) {
  const span = to - from;
  return { from: new Date(from.getTime() - span - 1), to: new Date(from.getTime() - 1) };
}

async function loadOrdersWithDetails(businessId, range) {
  const where = { businessId, status: { [Op.in]: ['delivered', 'returned'] } };
  if (range) where.orderDate = { [Op.gte]: range.from, [Op.lte]: range.to };
  const rows = await Order.findAll({
    where,
    include: [{ model: OrderItem, as: 'items' }, { model: Payment }],
    order: [['orderDate', 'ASC']],
  });
  // Normalize association casing (Sequelize exposes hasMany as `Payments`).
  return rows.map((o) => ({ ...o.toJSON(), payments: o.Payments ? o.Payments.map((p) => p.toJSON()) : [] }));
}

async function loadReturns(businessId, range) {
  const where = { businessId };
  if (range) where.returnDate = { [Op.gte]: range.from, [Op.lte]: range.to };
  const rows = await ReturnRecord.findAll({ where, include: [{ model: Order, include: [{ model: OrderItem, as: 'items' }] }] });
  return rows.map((r) => {
    const oi = r.Order && r.Order.items ? r.Order.items.find((i) => i.productId === r.productId) : null;
    return {
      ...r.toJSON(),
      itemValue: oi ? Number(oi.unitPrice) * r.quantity : 0,
      itemCost: oi ? Number(oi.unitCost) * r.quantity : 0,
    };
  });
}

// FR-20: sales dashboard aggregates.
async function salesSummary(businessId, period = 'month') {
  const range = periodRange(period);
  const where = { businessId };
  if (range) where.orderDate = { [Op.gte]: range.from, [Op.lte]: range.to };

  const orders = await Order.findAll({ where });
  const delivered = orders.filter((o) => o.status === 'delivered');
  const counts = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    confirmed: orders.filter((o) => o.status === 'confirmed').length,
    processing: orders.filter((o) => o.status === 'processing').length,
    shipped: orders.filter((o) => o.status === 'shipped' || o.status === 'out_for_delivery').length,
    delivered: delivered.length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    returned: orders.filter((o) => o.status === 'returned').length,
  };

  // FR-21: revenue from completed sales.
  const revenue = delivered.reduce((s, o) => s + Math.max(Number(o.subtotal) - Number(o.discount || 0), 0), 0);

  const prior = range ? priorRange(range) : null;
  let priorRevenue = null;
  if (prior) {
    const priorOrders = await Order.findAll({
      where: { businessId, status: 'delivered', orderDate: { [Op.gte]: prior.from, [Op.lte]: prior.to } },
    });
    priorRevenue = priorOrders.reduce((s, o) => s + Math.max(Number(o.subtotal) - Number(o.discount || 0), 0), 0);
  }

  return {
    period,
    from: range ? range.from : null,
    to: range ? range.to : null,
    counts,
    revenue: Math.round(revenue * 100) / 100,
    revenueChangePct: priorRevenue != null && priorRevenue > 0
      ? Math.round(((revenue - priorRevenue) / priorRevenue) * 1000) / 10
      : null,
    aov: delivered.length ? Math.round((revenue / delivered.length) * 100) / 100 : 0,
  };
}

// FR-22: profit analysis.
async function profitAnalysis(businessId, period = 'month') {
  const range = periodRange(period);
  const [orders, returns, expenses] = await Promise.all([
    loadOrdersWithDetails(businessId, range),
    loadReturns(businessId, range),
    Expense.findAll({ where: range ? { businessId, expenseDate: { [Op.gte]: range.from, [Op.lte]: range.to } } : { businessId } }),
  ]);

  const profit = computeProfit({ orders, returns, expenses });

  const prior = range ? priorRange(range) : null;
  let priorProfit = null;
  if (prior) {
    const [po, pr, pe] = await Promise.all([
      loadOrdersWithDetails(businessId, prior),
      loadReturns(businessId, prior),
      Expense.findAll({ where: { businessId, expenseDate: { [Op.gte]: prior.from, [Op.lte]: prior.to } } }),
    ]);
    priorProfit = computeProfit({ orders: po, returns: pr, expenses: pe });
  }

  return {
    period,
    ...profit,
    profitChangePct: priorProfit && priorProfit.profit !== 0
      ? Math.round(((profit.profit - priorProfit.profit) / Math.abs(priorProfit.profit)) * 1000) / 10
      : null,
    marginChangePct: priorProfit && priorProfit.margin
      ? Math.round(((profit.margin - priorProfit.margin) / priorProfit.margin) * 1000) / 10
      : null,
  };
}

// Daily sales series for charts (delivered + in-progress).
async function dailySeries(businessId, days = 30) {
  const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (days - 1));
  const rows = await Order.findAll({
    where: { businessId, orderDate: { [Op.gte]: from }, status: { [Op.in]: ['delivered', 'returned'] } },
    include: [{ model: OrderItem, as: 'items' }],
  });
  const byDay = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(from); d.setDate(d.getDate() + i);
    byDay[d.toISOString().slice(0, 10)] = { date: d.toISOString().slice(0, 10), orders: 0, units: 0, revenue: 0 };
  }
  for (const o of rows) {
    const key = new Date(o.orderDate).toISOString().slice(0, 10);
    if (!byDay[key]) continue;
    byDay[key].orders += 1;
    byDay[key].revenue += Math.max(Number(o.subtotal) - Number(o.discount || 0), 0);
    for (const it of o.items) byDay[key].units += it.quantity;
  }
  return Object.values(byDay).map((d) => ({ ...d, revenue: Math.round(d.revenue * 100) / 100 }));
}

// Monthly series for longer-horizon charts + AI feature input.
async function monthlySeries(businessId, months = 12) {
  const rows = await Order.findAll({
    where: { businessId, status: { [Op.in]: ['delivered', 'returned'] } },
    include: [{ model: OrderItem, as: 'items' }],
  });
  const byMonth = {};
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    byMonth[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = {
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, orders: 0, units: 0, revenue: 0,
    };
  }
  for (const o of rows) {
    const d = new Date(o.orderDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) continue;
    byMonth[key].orders += 1;
    byMonth[key].revenue += Math.max(Number(o.subtotal) - Number(o.discount || 0), 0);
    for (const it of o.items) byMonth[key].units += it.quantity;
  }
  return Object.values(byMonth).map((m) => ({ ...m, revenue: Math.round(m.revenue * 100) / 100 }));
}

// FR-23: product performance ranking.
async function productPerformance(businessId, period = 'month') {
  const range = periodRange(period);
  const where = { businessId, status: { [Op.in]: ['delivered', 'returned'] } };
  if (range) where.orderDate = { [Op.gte]: range.from, [Op.lte]: range.to };

  const rows = await Order.findAll({ where, include: [{ model: OrderItem, as: 'items' }] });
  const allOrdersInPeriod = await Order.findAll({
    where: range ? { businessId, orderDate: { [Op.gte]: range.from, [Op.lte]: range.to } } : { businessId },
  });

  const agg = {};
  for (const o of rows) {
    for (const it of o.items) {
      const a = agg[it.productId] = agg[it.productId] || {
        productId: it.productId, name: it.productName, unitsSold: 0, revenue: 0, profit: 0,
        returnedUnits: 0,
      };
      a.unitsSold += it.quantity;
      a.revenue += Number(it.lineTotal);
      a.profit += (Number(it.unitPrice) - Number(it.unitCost)) * it.quantity;
    }
  }
  const returns = await loadReturns(businessId, range);
  for (const r of returns) {
    if (agg[r.productId]) agg[r.productId].returnedUnits += r.quantity;
  }

  const cancelledUnits = {};
  const cancelledOrders = allOrdersInPeriod.filter((o) => o.status === 'cancelled');
  const cancelledItems = await OrderItem.findAll({ where: { orderId: cancelledOrders.map((o) => o.id) } });
  for (const it of cancelledItems) cancelledUnits[it.productId] = (cancelledUnits[it.productId] || 0) + it.quantity;

  const products = Object.values(agg).map((a) => ({
    ...a,
    revenue: Math.round(a.revenue * 100) / 100,
    profit: Math.round(a.profit * 100) / 100,
    returnRate: a.unitsSold ? Math.round((a.returnedUnits / a.unitsSold) * 1000) / 10 : 0,
    cancelledUnits: cancelledUnits[a.productId] || 0,
    cancellationRate: (a.unitsSold + (cancelledUnits[a.productId] || 0))
      ? Math.round((cancelledUnits[a.productId] || 0) / (a.unitsSold + (cancelledUnits[a.productId] || 0)) * 1000) / 10 : 0,
  }));
  products.sort((x, y) => y.revenue - x.revenue);
  return products;
}

// Dashboard bundle: one call for the landing page.
async function dashboard(businessId) {
  const [today, week, month, monthProfit, series30, perf, lowStock] = await Promise.all([
    salesSummary(businessId, 'today'),
    salesSummary(businessId, 'week'),
    salesSummary(businessId, 'month'),
    profitAnalysis(businessId, 'month'),
    dailySeries(businessId, 30),
    productPerformance(businessId, 'month'),
    require('./inventoryService').getInventoryOverview(businessId),
  ]);
  return {
    today, week, month, profit: monthProfit, series30,
    topProducts: perf.slice(0, 5),
    decliningProducts: perf.filter((p) => p.returnRate > 15 || p.cancellationRate > 25).slice(0, 5),
    lowStock: lowStock.filter((i) => i.status !== 'ok').sort((a, b) => a.currentStock - b.currentStock).slice(0, 8),
  };
}

module.exports = { periodRange, salesSummary, profitAnalysis, dailySeries, monthlySeries, productPerformance, dashboard, loadOrdersWithDetails, loadReturns };
