const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Business = sequelize.define('Business', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  logoUrl: { type: DataTypes.STRING },
  currency: { type: DataTypes.STRING, defaultValue: 'BDT' },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  address: { type: DataTypes.STRING },
  settings: {
    type: DataTypes.JSON,
    defaultValue: { lowStockNotify: true, defaultLeadTimeDays: 7, safetyStockDays: 5 },
  },
});

module.exports = Business;
