const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requirePermission, requireFinanceAccess } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const auth = require('../controllers/authController');
const catalog = require('../controllers/catalogController');
const crm = require('../controllers/crmController');
const analyticsCtl = require('../controllers/analyticsController');

const router = express.Router();

// NFR-05: throttle auth endpoints.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });

// ---- Health ----
router.get('/health', (req, res) => res.json({ status: 'ok', service: 'bizmind-api', time: new Date().toISOString() }));

// ---- Auth (FR-01/02) ----
router.post('/auth/register', authLimiter, auth.registerRules, validate, auth.register);
router.post('/auth/login', authLimiter, auth.login);
router.get('/auth/me', authenticate, auth.me);

// ---- Users / employees (section 7) ----
router.get('/users', authenticate, requirePermission('users'), auth.listEmployees);
router.post('/users', authenticate, requirePermission('users'), auth.createEmployeeRules, validate, auth.createEmployee);
router.put('/users/:id', authenticate, requirePermission('users'), auth.updateEmployee);

// ---- Business profile (FR-04) ----
router.get('/business', authenticate, analyticsCtl.getBusiness);
router.put('/business', authenticate, requirePermission('settings'), analyticsCtl.updateBusiness);

// ---- Categories ----
router.get('/categories', authenticate, catalog.listCategories);
router.post('/categories', authenticate, requirePermission('products'), catalog.createCategory);
router.put('/categories/:id', authenticate, requirePermission('products'), catalog.updateCategory);
router.delete('/categories/:id', authenticate, requirePermission('products'), catalog.deleteCategory);

// ---- Products (FR-05/06/07, SRS 25.2) ----
router.get('/products', authenticate, catalog.listProducts);
router.get('/products/:id', authenticate, catalog.getProduct);
router.post('/products', authenticate, requirePermission('products'), catalog.createProduct);
router.put('/products/:id', authenticate, requirePermission('products'), catalog.updateProduct);
router.delete('/products/:id', authenticate, requirePermission('products'), catalog.deleteProduct);

// ---- Inventory (FR-08/09/10) ----
router.get('/inventory', authenticate, catalog.inventoryOverview);
router.get('/inventory/history', authenticate, catalog.inventoryHistory);
router.post('/inventory/adjust', authenticate, requirePermission('inventory'), catalog.adjustStock);

// ---- Customers (FR-11/12) ----
router.get('/customers', authenticate, crm.listCustomers);
router.get('/customers/:id', authenticate, crm.getCustomer);
router.post('/customers', authenticate, crm.createCustomer);
router.put('/customers/:id', authenticate, crm.updateCustomer);

// ---- Orders (FR-13/14/15) ----
router.get('/orders', authenticate, crm.listOrders);
router.get('/orders/:id', authenticate, crm.getOrder);
router.post('/orders', authenticate, requirePermission('orders'), crm.createOrder);
router.put('/orders/:id', authenticate, requirePermission('orders'), crm.updateOrderStatus);
router.post('/orders/:id/returns', authenticate, requirePermission('orders'), crm.recordReturn);

// ---- Returns / cancellations (FR-18/19) ----
router.get('/returns', authenticate, analyticsCtl.listReturns);
router.get('/cancellations', authenticate, analyticsCtl.listCancellations);

// ---- Analytics (FR-20..23) ----
router.get('/analytics/dashboard', authenticate, analyticsCtl.getDashboard);
router.get('/analytics/sales', authenticate, analyticsCtl.getSales);
router.get('/analytics/profit', authenticate, requireFinanceAccess, analyticsCtl.getProfit); // BR-04
router.get('/analytics/products', authenticate, analyticsCtl.getProductPerformance);
router.get('/analytics/series', authenticate, analyticsCtl.getSeries);

// ---- Expenses ----
router.get('/expenses', authenticate, requireFinanceAccess, analyticsCtl.listExpenses);
router.post('/expenses', authenticate, requireFinanceAccess, analyticsCtl.createExpense);
router.delete('/expenses/:id', authenticate, requireFinanceAccess, analyticsCtl.deleteExpense);

// ---- AI (FR-24..29, SRS 25.2) ----
router.get('/ai/sales-forecast', authenticate, requirePermission('ai'), analyticsCtl.getSalesForecast);
router.get('/ai/demand-prediction', authenticate, requirePermission('ai'), analyticsCtl.getDemandPrediction);
router.get('/ai/risk-prediction', authenticate, requirePermission('ai'), analyticsCtl.getRiskPrediction);
router.get('/ai/recommendations', authenticate, requirePermission('ai'), analyticsCtl.getRecommendations);
router.get('/ai/insights', authenticate, requirePermission('ai'), analyticsCtl.getInsights);
router.post('/ai/assistant', authenticate, requirePermission('ai'), analyticsCtl.askAssistant);
router.get('/ai/recommendations/list', authenticate, analyticsCtl.listAiRecommendations);
router.put('/ai/recommendations/:id/status', authenticate, analyticsCtl.markRecommendation);

// ---- Notifications ----
router.get('/notifications', authenticate, analyticsCtl.listNotifications);
router.post('/notifications/read-all', authenticate, analyticsCtl.markNotificationsRead);

module.exports = router;
