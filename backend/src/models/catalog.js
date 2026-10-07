const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING },
});

// FR-05/06/07: product catalog. isActive supports soft deletion (FR-07).
const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  categoryId: { type: DataTypes.INTEGER },
  name: { type: DataTypes.STRING, allowNull: false },
  sku: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  imageUrl: { type: DataTypes.STRING },
  sellingPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
  costPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0 } },
  initialStock: { type: DataTypes.INTEGER, defaultValue: 0, validate: { min: 0 } },
  reorderLevel: { type: DataTypes.INTEGER, defaultValue: 10, validate: { min: 0 } },
  leadTimeDays: { type: DataTypes.INTEGER, defaultValue: 7 },
  unit: { type: DataTypes.STRING, defaultValue: 'pcs' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = { Category, Product };
