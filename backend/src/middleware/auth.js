const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, Business } = require('../models');
const { ApiError } = require('./errorHandler');

// FR-02/29.6: authenticate JWT bearer tokens.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Authentication required');

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new ApiError(401, 'Invalid or expired token');
    }

    const user = await User.findByPk(payload.sub);
    if (!user || !user.isActive) throw new ApiError(401, 'Account not found or disabled');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// FR-03/29.3: role-based authorization. Permission matrix per SRS section 7.
const ROLE_PERMISSIONS = {
  owner: ['products', 'inventory', 'orders', 'customers', 'finance', 'analytics', 'ai', 'users', 'settings'],
  manager: ['products', 'inventory', 'orders', 'customers', 'analytics', 'ai'],
  staff: ['orders', 'customers', 'products', 'inventory'],
  admin: ['products', 'inventory', 'orders', 'customers', 'finance', 'analytics', 'ai', 'users', 'settings', 'platform'],
};

function requirePermission(permission) {
  return (req, res, next) => {
    const perms = ROLE_PERMISSIONS[req.user.role] || [];
    if (!perms.includes(permission)) {
      return next(new ApiError(403, `Role '${req.user.role}' lacks '${permission}' permission`));
    }
    next();
  };
}

// BR-04: only owner/admin may open financial reports.
function requireFinanceAccess(req, res, next) {
  if (!['owner', 'admin'].includes(req.user.role)) {
    return next(new ApiError(403, 'Financial reports are restricted to business owners'));
  }
  next();
}

// 29.4 data protection: users are scoped to their own business. Admin is platform-wide.
function resolveBusinessScope(req) {
  if (req.user.role === 'admin') return null; // all businesses
  return req.user.businessId;
}

module.exports = { authenticate, requirePermission, requireFinanceAccess, resolveBusinessScope, ROLE_PERMISSIONS };
