const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const env = require('../config/env');
const { User, Business } = require('../models');
const { ApiError, validate } = require('../middleware/errorHandler');

const registerRules = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional({ checkFalsy: true }).trim(),
  body('businessName').trim().isLength({ min: 2 }).withMessage('Business name is required'),
];

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

// FR-01: registration — creates business + owner account in one step.
async function register(req, res, next) {
  try {
    const { name, email, password, phone, businessName, currency } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new ApiError(409, 'An account with this email already exists');

    const business = await Business.create({ name: businessName, currency: currency || 'BDT', email });
    const passwordHash = await bcrypt.hash(password, 10); // 29.2: bcrypt hashing
    const user = await User.create({ businessId: business.id, name, email, phone, passwordHash, role: 'owner' });

    res.status(201).json({
      success: true,
      message: 'Account created',
      token: signToken(user),
      user: user.toPublicJSON(),
      business,
    });
  } catch (err) { next(err); }
}

// FR-02: login.
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new ApiError(400, 'Email and password are required');

    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ApiError(401, 'Invalid email or password');
    }
    if (!user.isActive) throw new ApiError(403, 'Account is disabled. Contact your business owner.');

    const business = user.businessId ? await Business.findByPk(user.businessId) : null;
    res.json({
      success: true,
      token: signToken(user),
      user: user.toPublicJSON(),
      business,
    });
  } catch (err) { next(err); }
}

async function me(req, res) {
  const business = req.user.businessId ? await Business.findByPk(req.user.businessId) : null;
  res.json({ success: true, user: req.user.toPublicJSON(), business });
}

// Owner invites employees (FR section 7.1 "Manage employees").
const createEmployeeRules = [
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['manager', 'staff']).withMessage('Role must be manager or staff'),
];

async function createEmployee(req, res, next) {
  try {
    const { name, email, password, phone, role } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new ApiError(409, 'Email already in use');
    const user = await User.create({
      businessId: req.user.businessId, name, email, phone,
      passwordHash: await bcrypt.hash(password, 10), role,
    });
    res.status(201).json({ success: true, user: user.toPublicJSON() });
  } catch (err) { next(err); }
}

async function listEmployees(req, res) {
  const users = await User.findAll({
    where: req.user.role === 'admin' ? {} : { businessId: req.user.businessId },
    order: [['id', 'ASC']],
  });
  res.json({ success: true, users: users.map((u) => u.toPublicJSON()) });
}

async function updateEmployee(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    if (req.user.role !== 'admin' && user.businessId !== req.user.businessId) throw new ApiError(403, 'Not your business');
    const { role, isActive, name, phone } = req.body;
    if (role) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    await user.save();
    res.json({ success: true, user: user.toPublicJSON() });
  } catch (err) { next(err); }
}

module.exports = { register, login, me, createEmployee, listEmployees, updateEmployee, registerRules, createEmployeeRules, validate };
