const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// FR-11: customer registry.
const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, validate: { isEmailOrNull(value) { if (value && !/^\S+@\S+\.\S+$/.test(value)) throw new Error('Invalid email'); } } },
  address: { type: DataTypes.STRING },
  city: { type: DataTypes.STRING },
  notes: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Customer;
