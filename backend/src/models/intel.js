const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Recorded expenses feed the profit formula (FR-22: "Other Recorded Expenses").
const Expense = sequelize.define('Expense', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  category: { type: DataTypes.ENUM('marketing', 'rent', 'transport', 'packaging', 'salary', 'other'), defaultValue: 'other' },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
  description: { type: DataTypes.STRING },
  expenseDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});

// Log of every AI prediction served (AI_Predictions entity, SRS section 28).
const AIPrediction = sequelize.define('AIPrediction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('sales_forecast', 'demand_prediction', 'risk_prediction', 'inventory_recommendation', 'insight'), allowNull: false },
  payload: { type: DataTypes.JSON },
  modelInfo: { type: DataTypes.JSON },
  requestedBy: { type: DataTypes.INTEGER },
});

// Actionable recommendations produced by the AI layer (AI_Recommendations entity).
const AIRecommendation = sequelize.define('AIRecommendation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER },
  type: { type: DataTypes.STRING, allowNull: false }, // restock / promote / watch_risk ...
  title: { type: DataTypes.STRING, allowNull: false },
  detail: { type: DataTypes.JSON },
  priority: { type: DataTypes.ENUM('low', 'medium', 'high'), defaultValue: 'medium' },
  status: { type: DataTypes.ENUM('new', 'viewed', 'applied'), defaultValue: 'new' },
});

// Notifications (FR-09 low stock alerts, system events).
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER },
  type: { type: DataTypes.ENUM('low_stock', 'order', 'ai_insight', 'system'), defaultValue: 'system' },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.STRING, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  entityType: { type: DataTypes.STRING },
  entityId: { type: DataTypes.INTEGER },
});

module.exports = { Expense, AIPrediction, AIRecommendation, Notification };
