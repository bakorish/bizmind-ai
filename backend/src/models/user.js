const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Roles per SRS section 7: owner, manager, staff (+ platform admin).
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: true }, // null => platform admin
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  phone: { type: DataTypes.STRING },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role: {
    type: DataTypes.ENUM('owner', 'manager', 'staff', 'admin'),
    allowNull: false,
    defaultValue: 'staff',
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

User.prototype.toPublicJSON = function () {
  return {
    id: this.id,
    businessId: this.businessId,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    isActive: this.isActive,
  };
};

module.exports = User;
