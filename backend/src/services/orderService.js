const { Op, literal } = require('sequelize');
const sequelize = require('../config/database');
const {
  Order, OrderItem, Product, Customer, Payment, ReturnRecord,
  Cancellation, Delivery, Inventory, Notification,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const { STATUS_TRANSITIONS, ORDER_STATUSES } = require('../models/order');
const { applyStockChange, checkLowStock } = require('./inventoryService');

async function nextOrderNo(businessId, transaction) {
  const count = await Order.count({ where: { businessId }, transaction });
  const year = new Date().getFullYear();
  return `BM-${year}-${String(count + 1).padStart(5, '0')}`;
}

/**
 * FR-13: create an order with items. Totals are computed server-side from the
 * product catalog (price tampering from the client is impossible).
 * Stock is deducted when the order is CONFIRMED (FR-08), not at creation.
 */
async function createOrder({ businessId, userId, payload }) {
  const { customerId, items = [], discount = 0, deliveryCharge = 0, paymentMethod = 'cod',
          shippingAddress, notes, placedVia, courierName, courierCharge = 0, initialStatus = 'pending' } = payload;

  if (!customerId) throw new ApiError(400, 'customerId is required');
  if (!items.length) throw new ApiError(400, 'Order must contain at least one item');

  const customer = await Customer.findOne({ where: { id: customerId, businessId } });
  if (!customer) throw new ApiError(404, 'Customer not found');

  const result = await sequelize.transaction(async (tx) => {
    let subtotal = 0;
    const lineItems = [];
    for (const it of items) {
      const product = await Product.findOne({ where: { id: it.productId, businessId, isActive: true }, transaction: tx });
      if (!product) throw new ApiError(404, `Product ${it.productId} not found`);
      const qty = Number(it.quantity);
      if (!Number.isInteger(qty) || qty < 1) throw new ApiError(400, `Invalid quantity for ${product.name}`);

      const unitPrice = Number(it.unitPrice ?? product.sellingPrice);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      lineItems.push({ product, qty, unitPrice, lineTotal });
    }

    const total = subtotal - Number(discount || 0) + Number(deliveryCharge || 0);
    if (total < 0) throw new ApiError(400, 'Discount cannot exceed order value');

    const order = await Order.create({
      businessId, orderNo: await nextOrderNo(businessId, tx), customerId,
      status: initialStatus, subtotal, discount: Number(discount || 0),
      deliveryCharge: Number(deliveryCharge || 0), total,
      paymentMethod, paymentStatus: 'pending',
      placedVia: placedVia || 'direct',
      shippingAddress: shippingAddress || customer.address,
      notes, createdById: userId,
      orderDate: payload.orderDate || new Date(),
    }, { transaction: tx });

    for (const li of lineItems) {
      await OrderItem.create({
        orderId: order.id, productId: li.product.id, productName: li.product.name,
        quantity: li.qty, unitPrice: li.unitPrice, unitCost: Number(li.product.costPrice),
        lineTotal: li.lineTotal,
      }, { transaction: tx });
    }

    // FR-16/17: payment shell (COD detail recorded here; collected on delivery).
    await Payment.create({
      businessId, orderId: order.id, method: paymentMethod, status: 'pending',
      amount: total, deliveryCharge: Number(deliveryCharge || 0),
      courierCharge: Number(courierCharge || 0),
    }, { transaction: tx });

    if (courierName || deliveryCharge) {
      await Delivery.create({
        businessId, orderId: order.id, courierName: courierName || 'In-house',
        address: shippingAddress || customer.address, city: customer.city,
        deliveryCharge: Number(deliveryCharge || 0), courierCharge: Number(courierCharge || 0),
      }, { transaction: tx });
    }

    // If created directly as confirmed, deduct stock now.
    if (initialStatus === 'confirmed') {
      for (const li of lineItems) {
        await applyStockChange({
          businessId, productId: li.product.id, type: 'sold', quantity: -li.qty,
          referenceType: 'order', referenceId: order.id, createdBy: userId,
        }, tx);
        await checkLowStock(businessId, li.product.id, tx);
      }
    }

    return order;
  });

  return getOrderDetail(businessId, result.id);
}

// BR-01: strict lifecycle enforcement.
function assertTransition(from, to) {
  if (from === to) throw new ApiError(400, `Order is already ${to}`);
  const allowed = STATUS_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new ApiError(400, `Invalid status transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none (final state)'}`);
  }
}

/**
 * FR-14 + business rules:
 *  - confirm  → deduct stock (BR-02, FR-08)
 *  - cancel   → restock if stock was deducted; record reason (FR-19)
 *  - shipped/out_for_delivery → sync delivery record
 *  - delivered → mark payment collected (COD), set deliveredAt
 */
async function updateStatus({ businessId, userId, orderId, to, reason = null, note = null }) {
  if (!ORDER_STATUSES.includes(to)) throw new ApiError(400, `Unknown status '${to}'`);

  const result = await sequelize.transaction(async (tx) => {
    const order = await Order.findOne({ where: { id: orderId, businessId }, transaction: tx });
    if (!order) throw new ApiError(404, 'Order not found');
    assertTransition(order.status, to);
    const from = order.status;

    const items = await OrderItem.findAll({ where: { orderId: order.id }, transaction: tx });

    if (to === 'confirmed') {
      for (const item of items) {
        await applyStockChange({
          businessId, productId: item.productId, type: 'sold', quantity: -item.quantity,
          referenceType: 'order', referenceId: order.id, createdBy: userId,
        }, tx);
        await checkLowStock(businessId, item.productId, tx);
      }
    }

    if (to === 'cancelled') {
      // Stock was already deducted for confirmed/processing orders → restore (BR-02).
      if (['confirmed', 'processing'].includes(from)) {
        for (const item of items) {
          await applyStockChange({
            businessId, productId: item.productId, type: 'returned', quantity: item.quantity,
            referenceType: 'cancellation', referenceId: order.id, note: 'Order cancelled',
          }, tx);
        }
      }
      await Cancellation.create({
        businessId, orderId: order.id, reason: reason || 'other', stage: from,
        note, byUserId: userId,
      }, { transaction: tx });
      order.cancelledAt = new Date();
    }

    if (to === 'shipped') {
      const [delivery] = await Delivery.findOrCreate({
        where: { orderId: order.id }, defaults: { businessId, orderId: order.id, status: 'shipped', shippedAt: new Date() }, transaction: tx,
      });
      delivery.status = 'shipped';
      delivery.shippedAt = new Date();
      await delivery.save({ transaction: tx });
    }

    if (to === 'out_for_delivery') {
      await Delivery.update({ status: 'out_for_delivery' }, { where: { orderId: order.id }, transaction: tx });
    }

    if (to === 'delivered') {
      order.deliveredAt = new Date();
      // COD: money collected on hand-over.
      const payment = await Payment.findOne({ where: { orderId: order.id }, transaction: tx });
      if (payment) {
        payment.status = 'paid';
        payment.paidOn = new Date();
        if (order.paymentMethod === 'cod') payment.collectedAmount = Number(order.total);
        await payment.save({ transaction: tx });
      }
      order.paymentStatus = 'paid';
      await Delivery.update({ status: 'delivered', deliveredAt: new Date() }, { where: { orderId: order.id }, transaction: tx });
    }

    order.status = to;
    await order.save({ transaction: tx });
    return order;
  });

  return getOrderDetail(businessId, result.id);
}

/**
 * FR-18: record a (partial) return. Restocks resellable units (BR-05),
 * logs damaged units without restock, updates refund status.
 */
async function recordReturn({ businessId, userId, orderId, items, note }) {
  const result = await sequelize.transaction(async (tx) => {
    const order = await Order.findOne({ where: { id: orderId, businessId }, transaction: tx });
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.status !== 'delivered' && order.status !== 'returned') {
      throw new ApiError(400, 'Returns can only be recorded for delivered orders');
    }

    const orderItems = await OrderItem.findAll({ where: { orderId }, transaction: tx });

    for (const r of items) {
      const oi = orderItems.find((x) => x.id === r.orderItemId || x.productId === r.productId);
      if (!oi) throw new ApiError(404, `Order item for product ${r.productId} not found`);
      if (r.quantity < 1 || r.quantity > oi.quantity) throw new ApiError(400, `Return quantity invalid for ${oi.productName}`);

      const already = await ReturnRecord.sum('quantity', { where: { orderId, productId: r.productId }, transaction: tx }) || 0;
      if (already + r.quantity > oi.quantity) throw new ApiError(400, `Returned quantity exceeds purchased quantity for ${oi.productName}`);

      const unitPrice = Number(oi.unitPrice);
      const unitCost = Number(oi.unitCost);
      await ReturnRecord.create({
        businessId, orderId, productId: r.productId, quantity: r.quantity,
        reason: r.reason || 'other', condition: r.condition || 'resellable',
        refundStatus: r.refundStatus || 'pending',
        refundAmount: unitPrice * r.quantity,
        note: r.note || note,
      }, { transaction: tx });

      // BR-05: resellable returns go back to stock; damaged units do not.
      if ((r.condition || 'resellable') === 'resellable') {
        await applyStockChange({
          businessId, productId: r.productId, type: 'returned', quantity: r.quantity,
          referenceType: 'return', referenceId: order.id, createdBy: userId,
        }, tx);
      } else {
        await applyStockChange({
          businessId, productId: r.productId, type: 'damaged', quantity: 0,
          referenceType: 'return', referenceId: order.id,
          note: `${r.quantity} unit(s) damaged — not restocked`, createdBy: userId,
        }, tx);
      }

      // Return delivery charge penalty recorded on the payment row.
      const payment = await Payment.findOne({ where: { orderId }, transaction: tx });
      if (payment && order.paymentMethod === 'cod') {
        payment.returnCharge = Number(payment.returnCharge || 0) + Number(r.returnCharge || 60);
        await payment.save({ transaction: tx });
      }
    }

    const totalReturned = await ReturnRecord.sum('quantity', { where: { orderId }, transaction: tx }) || 0;
    const totalQty = orderItems.reduce((s, i) => s + i.quantity, 0);
    if (totalReturned >= totalQty) {
      order.status = 'returned';
      order.returnedAt = new Date();
      await Delivery.update({ status: 'returned' }, { where: { orderId }, transaction: tx });
      const payment = await Payment.findOne({ where: { orderId }, transaction: tx });
      if (payment) { payment.status = 'refunded'; await payment.save({ transaction: tx }); }
      order.paymentStatus = 'refunded';
    }
    await order.save({ transaction: tx });
    return order;
  });

  return getOrderDetail(businessId, result.id);
}

async function getOrderDetail(businessId, orderId) {
  const order = await Order.findOne({
    where: { id: orderId, ...(businessId ? { businessId } : {}) },
    include: [
      { model: Customer },
      { model: OrderItem, as: 'items' },
      { model: Payment },
      { model: ReturnRecord },
      { model: Cancellation },
      { model: Delivery },
    ],
  });
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
}

// FR-15: search by order id/no, customer name/phone, date range, product, status.
async function searchOrders({ businessId, query, status, from, to, productId, customerId, page = 1, limit = 20 }) {
  const where = { businessId };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (from || to) {
    where.orderDate = {};
    if (from) where.orderDate[Op.gte] = new Date(from);
    if (to) where.orderDate[Op.lte] = new Date(`${String(to).slice(0, 10)}T23:59:59`);
  }

  let orderIdsByProduct = null;
  if (productId) {
    const rows = await OrderItem.findAll({ where: { productId }, attributes: ['orderId'] });
    orderIdsByProduct = rows.map((r) => r.orderId);
    where.id = { [Op.in]: orderIdsByProduct.length ? orderIdsByProduct : [-1] };
  }

  if (query) {
    const customers = await Customer.findAll({
      where: { businessId, [Op.or]: [{ name: { [Op.like]: `%${query}%` } }, { phone: { [Op.like]: `%${query}%` } }] },
      attributes: ['id'],
    });
    where[Op.or] = [
      { orderNo: { [Op.like]: `%${query}%` } },
      { customerId: { [Op.in]: customers.map((c) => c.id) } },
    ];
  }

  const { rows, count } = await Order.findAndCountAll({
    where,
    include: [{ model: Customer }, { model: OrderItem, as: 'items' }],
    order: [['orderDate', 'DESC']],
    limit: Math.min(limit, 100), offset: (page - 1) * limit,
    distinct: true,
  });
  return { total: count, page: Number(page), orders: rows };
}

// FR-12: customer history summary.
async function customerHistory(businessId, customerId) {
  const orders = await Order.findAll({ where: { businessId, customerId } });
  const delivered = orders.filter((o) => o.status === 'delivered');
  const returned = orders.filter((o) => o.status === 'returned');
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const totalSpending = delivered.reduce((s, o) => s + Number(o.total), 0);
  return {
    totalOrders: orders.length,
    completedOrders: delivered.length,
    cancelledOrders: cancelled.length,
    returnedOrders: returned.length,
    totalSpending: Math.round(totalSpending * 100) / 100,
    cancellationRate: orders.length ? orders.filter((o) => ['cancelled', 'returned'].includes(o.status)).length / orders.length : 0,
  };
}

module.exports = { createOrder, updateStatus, recordReturn, getOrderDetail, searchOrders, customerHistory, assertTransition, nextOrderNo };
