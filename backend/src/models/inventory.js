const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// FR-08: current stock per product.
const Inventory = sequelize.define('Inventory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  currentStock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
});

// FR-10: full movement history (initial / sold / returned / damaged / restock / adjustment).
const INV_TX_TYPES = ['initial', 'sold', 'restock', 'returned', 'damaged', 'adjustment'];

const InventoryTransaction = sequelize.define('InventoryTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM(...INV_TX_TYPES), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false }, // signed: negative = out
  balanceAfter: { type: DataTypes.INTEGER, allowNull: false },
  referenceType: { type: DataTypes.STRING }, // order / return / manual
  referenceId: { type: DataTypes.INTEGER },
  note: { type: DataTypes.STRING },
  createdBy: { type: DataTypes.INTEGER },
});

module.exports = { Inventory, InventoryTransaction, INV_TX_TYPES };
