const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// FR-16/FR-17: payments incl. COD detail.
const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  method: { type: DataTypes.STRING, allowNull: false }, // cod/bkash/...
  status: { type: DataTypes.ENUM('pending', 'paid', 'partially_paid', 'refunded'), defaultValue: 'pending' },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  // COD-specific (FR-17)
  deliveryCharge: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  collectedAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  courierCharge: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  returnCharge: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  paidOn: { type: DataTypes.DATE },
  note: { type: DataTypes.STRING },
});

// FR-18: returned orders.
const ReturnRecord = sequelize.define('ReturnRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  reason: { type: DataTypes.STRING, allowNull: false },
  refundStatus: { type: DataTypes.ENUM('none', 'pending', 'refunded'), defaultValue: 'none' },
  refundAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  condition: { type: DataTypes.ENUM('resellable', 'damaged'), defaultValue: 'resellable' },
  returnDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  note: { type: DataTypes.STRING },
});

// FR-19: cancellation reasons.
const CANCELLATION_REASONS = [
  'customer_changed_mind', 'incorrect_product', 'incorrect_address',
  'customer_unreachable', 'delivery_delay', 'price_too_high', 'other',
];

const Cancellation = sequelize.define('Cancellation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.ENUM(...CANCELLATION_REASONS), allowNull: false },
  stage: { type: DataTypes.STRING }, // status the order was in when cancelled
  note: { type: DataTypes.STRING },
  cancelledOn: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  byUserId: { type: DataTypes.INTEGER },
});

// Delivery records.
const Delivery = sequelize.define('Delivery', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  courierName: { type: DataTypes.STRING, defaultValue: 'In-house' },
  trackingCode: { type: DataTypes.STRING },
  address: { type: DataTypes.STRING },
  city: { type: DataTypes.STRING },
  deliveryCharge: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  courierCharge: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  status: { type: DataTypes.ENUM('pending', 'shipped', 'out_for_delivery', 'delivered', 'returned'), defaultValue: 'pending' },
  shippedAt: { type: DataTypes.DATE },
  deliveredAt: { type: DataTypes.DATE },
});

module.exports = { Payment, ReturnRecord, Cancellation, Delivery, CANCELLATION_REASONS };
