const sequelize = require('../config/database');
const Business = require('./business');
const User = require('./user');
const { Category, Product } = require('./catalog');
const Customer = require('./customer');
const { Order, OrderItem } = require('./order');
const { Inventory, InventoryTransaction } = require('./inventory');
const { Payment, ReturnRecord, Cancellation, Delivery } = require('./fulfillment');
const { Expense, AIPrediction, AIRecommendation, Notification } = require('./intel');

// ---- Associations (SRS section 28: Business -> Users/Products/Customers/Orders ...) ----
Business.hasMany(User, { foreignKey: 'businessId' });
User.belongsTo(Business, { foreignKey: 'businessId' });

Business.hasMany(Category, { foreignKey: 'businessId' });
Category.belongsTo(Business, { foreignKey: 'businessId' });
Category.hasMany(Product, { foreignKey: 'categoryId' });
Product.belongsTo(Category, { foreignKey: 'categoryId' });

Business.hasMany(Product, { foreignKey: 'businessId' });
Product.belongsTo(Business, { foreignKey: 'businessId' });
Product.hasOne(Inventory, { foreignKey: 'productId' });
Inventory.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(InventoryTransaction, { foreignKey: 'productId' });

Business.hasMany(Customer, { foreignKey: 'businessId' });
Customer.belongsTo(Business, { foreignKey: 'businessId' });
Customer.hasMany(Order, { foreignKey: 'customerId' });

Business.hasMany(Order, { foreignKey: 'businessId' });
Order.belongsTo(Business, { foreignKey: 'businessId' });
Order.belongsTo(Customer, { foreignKey: 'customerId' });
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId' });

Order.hasMany(Payment, { foreignKey: 'orderId' });
Payment.belongsTo(Order, { foreignKey: 'orderId' });
Order.hasMany(ReturnRecord, { foreignKey: 'orderId' });
ReturnRecord.belongsTo(Order, { foreignKey: 'orderId' });
Order.hasOne(Cancellation, { foreignKey: 'orderId' });
Cancellation.belongsTo(Order, { foreignKey: 'orderId' });
Order.hasOne(Delivery, { foreignKey: 'orderId' });
Delivery.belongsTo(Order, { foreignKey: 'orderId' });

Business.hasMany(Expense, { foreignKey: 'businessId' });
Business.hasMany(AIPrediction, { foreignKey: 'businessId' });
Business.hasMany(AIRecommendation, { foreignKey: 'businessId' });
Business.hasMany(Notification, { foreignKey: 'businessId' });

module.exports = {
  sequelize,
  Business, User, Category, Product, Customer, Order, OrderItem,
  Inventory, InventoryTransaction, Payment, ReturnRecord, Cancellation,
  Delivery, Expense, AIPrediction, AIRecommendation, Notification,
};
