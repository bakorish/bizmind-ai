const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// FR-14: order statuses.
const ORDER_STATUSES = [
  'pending', 'confirmed', 'processing', 'shipped',
  'out_for_delivery', 'delivered', 'cancelled', 'returned',
];

// BR-01: allowed status transitions. An order cannot be delivered before shipment.
const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

const PAYMENT_METHODS = ['cod', 'bkash', 'nagad', 'rocket', 'card', 'bank_transfer'];
const PAYMENT_STATUSES = ['pending', 'paid', 'partially_paid', 'refunded'];

const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  orderNo: { type: DataTypes.STRING, allowNull: false, unique: true },
  customerId: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM(...ORDER_STATUSES), defaultValue: 'pending' },
  orderDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  discount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  deliveryCharge: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  paymentMethod: { type: DataTypes.ENUM(...PAYMENT_METHODS), defaultValue: 'cod' },
  paymentStatus: { type: DataTypes.ENUM(...PAYMENT_STATUSES), defaultValue: 'pending' },
  placedVia: { type: DataTypes.STRING, defaultValue: 'direct' }, // facebook/instagram/website/phone/direct
  shippingAddress: { type: DataTypes.STRING },
  riskScore: { type: DataTypes.FLOAT, allowNull: true }, // cached AI risk (0-100)
  riskLevel: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT },
  deliveredAt: { type: DataTypes.DATE },
  cancelledAt: { type: DataTypes.DATE },
  returnedAt: { type: DataTypes.DATE },
  createdById: { type: DataTypes.INTEGER },
});

const OrderItem = sequelize.define('OrderItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  productName: { type: DataTypes.STRING, allowNull: false }, // snapshot
  quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  unitCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false }, // snapshot for profit calc
  lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
});

module.exports = { Order, OrderItem, ORDER_STATUSES, STATUS_TRANSITIONS, PAYMENT_METHODS, PAYMENT_STATUSES };
