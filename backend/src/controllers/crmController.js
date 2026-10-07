const { Op } = require('sequelize');
const { Customer, Order } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const orderService = require('../services/orderService');

// ---------------- Customers (FR-11/12) ----------------
async function listCustomers(req, res) {
  const { search } = req.query;
  const where = { businessId: req.user.businessId };
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }
  const customers = await Customer.findAll({ where, order: [['name', 'ASC']] });
  const withStats = await Promise.all(customers.map(async (c) => {
    const stats = await orderService.customerHistory(req.user.businessId, c.id);
    return { ...c.toJSON(), ...stats };
  }));
  res.json({ success: true, customers: withStats });
}

async function getCustomer(req, res, next) {
  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!customer) throw new ApiError(404, 'Customer not found');
    const stats = await orderService.customerHistory(req.user.businessId, customer.id);
    const orders = await Order.findAll({
      where: { customerId: customer.id, businessId: req.user.businessId },
      order: [['orderDate', 'DESC']], limit: 50,
    });
    res.json({ success: true, customer: { ...customer.toJSON(), ...stats }, orders });
  } catch (err) { next(err); }
}

async function createCustomer(req, res, next) {
  try {
    const dupe = await Customer.findOne({ where: { businessId: req.user.businessId, phone: req.body.phone } });
    if (dupe) throw new ApiError(409, `A customer with phone ${req.body.phone} already exists`);
    const customer = await Customer.create({ businessId: req.user.businessId, ...req.body });
    res.status(201).json({ success: true, customer });
  } catch (err) { next(err); }
}

async function updateCustomer(req, res, next) {
  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!customer) throw new ApiError(404, 'Customer not found');
    delete req.body.businessId;
    await customer.update(req.body);
    res.json({ success: true, customer });
  } catch (err) { next(err); }
}

// ---------------- Orders (FR-13/14/15) ----------------
async function listOrders(req, res, next) {
  try {
    const result = await orderService.searchOrders({
      businessId: req.user.businessId,
      query: req.query.q,
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
      productId: req.query.productId,
      customerId: req.query.customerId,
      page: parseInt(req.query.page || '1', 10),
      limit: parseInt(req.query.limit || '20', 10),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function getOrder(req, res, next) {
  try {
    const order = await orderService.getOrderDetail(req.user.businessId, req.params.id);
    res.json({ success: true, order });
  } catch (err) { next(err); }
}

async function createOrder(req, res, next) {
  try {
    const order = await orderService.createOrder({ businessId: req.user.businessId, userId: req.user.id, payload: req.body });
    res.status(201).json({ success: true, order });
  } catch (err) { next(err); }
}

async function updateOrderStatus(req, res, next) {
  try {
    const order = await orderService.updateStatus({
      businessId: req.user.businessId, userId: req.user.id,
      orderId: Number(req.params.id), to: req.body.status,
      reason: req.body.reason, note: req.body.note,
    });
    res.json({ success: true, order });
  } catch (err) { next(err); }
}

async function recordReturn(req, res, next) {
  try {
    const order = await orderService.recordReturn({
      businessId: req.user.businessId, userId: req.user.id,
      orderId: Number(req.params.id), items: req.body.items || [], note: req.body.note,
    });
    res.json({ success: true, order });
  } catch (err) { next(err); }
}

module.exports = {
  listCustomers, getCustomer, createCustomer, updateCustomer,
  listOrders, getOrder, createOrder, updateOrderStatus, recordReturn,
};
