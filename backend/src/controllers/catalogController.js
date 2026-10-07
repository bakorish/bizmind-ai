const { body, query } = require('express-validator');
const { Category, Product, Inventory, InventoryTransaction } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const inventoryService = require('../services/inventoryService');
const sequelize = require('../config/database');

// ---------------- Categories ----------------
async function listCategories(req, res) {
  const categories = await Category.findAll({
    where: { businessId: req.user.businessId }, order: [['name', 'ASC']],
  });
  res.json({ success: true, categories });
}

async function createCategory(req, res, next) {
  try {
    const category = await Category.create({ businessId: req.user.businessId, ...req.body });
    res.status(201).json({ success: true, category });
  } catch (err) { next(err); }
}

async function updateCategory(req, res, next) {
  try {
    const category = await Category.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!category) throw new ApiError(404, 'Category not found');
    await category.update(req.body);
    res.json({ success: true, category });
  } catch (err) { next(err); }
}

async function deleteCategory(req, res, next) {
  try {
    const category = await Category.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!category) throw new ApiError(404, 'Category not found');
    const inUse = await Product.count({ where: { categoryId: category.id, businessId: req.user.businessId } });
    if (inUse > 0) throw new ApiError(400, 'Category has products. Move them first.');
    await category.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ---------------- Products (FR-05/06/07) ----------------
async function listProducts(req, res) {
  const { search, categoryId, includeInactive, lowStock } = req.query;
  const where = { businessId: req.user.businessId };
  if (!includeInactive) where.isActive = true;
  if (categoryId) where.categoryId = categoryId;
  if (search) where.name = { [require('sequelize').Op.like]: `%${search}%` };

  const products = await Product.findAll({
    where,
    include: [
      { model: Category },
      { model: Inventory, required: false },
    ],
    order: [['name', 'ASC']],
  });

  let mapped = products.map((p) => ({
    ...p.toJSON(),
    category: p.Category ? p.Category.name : null,
    currentStock: p.Inventory ? p.Inventory.currentStock : 0,
    margin: Number(p.sellingPrice) > 0
      ? Math.round(((Number(p.sellingPrice) - Number(p.costPrice)) / Number(p.sellingPrice)) * 1000) / 10
      : 0,
  }));
  if (lowStock === 'true') mapped = mapped.filter((p) => p.currentStock <= p.reorderLevel);
  res.json({ success: true, products: mapped });
}

async function getProduct(req, res, next) {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, businessId: req.user.businessId },
      include: [{ model: Category }, { model: Inventory }],
    });
    if (!product) throw new ApiError(404, 'Product not found');
    const history = await InventoryTransaction.findAll({
      where: { productId: product.id }, order: [['id', 'DESC']], limit: 50,
    });
    res.json({
      success: true,
      product: { ...product.toJSON(), currentStock: product.Inventory ? product.Inventory.currentStock : 0 },
      inventoryHistory: history,
    });
  } catch (err) { next(err); }
}

async function createProduct(req, res, next) {
  try {
    const { initialStock = 0, ...rest } = req.body;
    const result = await sequelize.transaction(async (tx) => {
      // SKU uniqueness inside the business
      if (rest.sku) {
        const dupe = await Product.findOne({ where: { businessId: req.user.businessId, sku: rest.sku }, transaction: tx });
        if (dupe) throw new ApiError(409, `SKU '${rest.sku}' already exists`);
      }
      const product = await Product.create({ businessId: req.user.businessId, ...rest }, { transaction: tx });
      if (Number(initialStock) > 0) {
        await inventoryService.applyStockChange({
          businessId: req.user.businessId, productId: product.id,
          type: 'initial', quantity: Number(initialStock),
          referenceType: 'product_create', referenceId: product.id,
          createdBy: req.user.id,
        }, tx);
      }
      return product;
    });
    res.status(201).json({ success: true, product: result });
  } catch (err) { next(err); }
}

async function updateProduct(req, res, next) {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!product) throw new ApiError(404, 'Product not found');
    // BR-03: only owner/manager may change prices.
    if ((req.body.sellingPrice !== undefined || req.body.costPrice !== undefined) && !['owner', 'manager', 'admin'].includes(req.user.role)) {
      throw new ApiError(403, 'Only owners and managers can modify product prices');
    }
    delete req.body.businessId; delete req.body.id;
    await product.update(req.body);
    res.json({ success: true, product });
  } catch (err) { next(err); }
}

// FR-07: soft delete keeps historical orders intact.
async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!product) throw new ApiError(404, 'Product not found');
    product.isActive = false;
    await product.save();
    res.json({ success: true, message: 'Product deactivated (order history preserved)' });
  } catch (err) { next(err); }
}

// ---------------- Inventory (FR-08/09/10) ----------------
async function inventoryOverview(req, res) {
  const items = await inventoryService.getInventoryOverview(req.user.businessId);
  res.json({ success: true, inventory: items, lowStockCount: items.filter((i) => i.status !== 'ok').length });
}

async function inventoryHistory(req, res, next) {
  try {
    const where = { businessId: req.user.businessId };
    if (req.query.productId) where.productId = req.query.productId;
    const rows = await InventoryTransaction.findAll({
      where, order: [['id', 'DESC']], limit: parseInt(req.query.limit || '200', 10),
      include: [{ model: Product, attributes: ['name', 'sku'] }],
    });
    res.json({ success: true, transactions: rows });
  } catch (err) { next(err); }
}

// Manual restock / damage / adjustment.
async function adjustStock(req, res, next) {
  try {
    const { productId, type, quantity, note } = req.body;
    if (!['restock', 'damaged', 'adjustment'].includes(type)) throw new ApiError(400, 'Type must be restock, damaged or adjustment');
    const product = await Product.findOne({ where: { id: productId, businessId: req.user.businessId } });
    if (!product) throw new ApiError(404, 'Product not found');

    const signed = type === 'restock' ? Math.abs(Number(quantity))
      : type === 'damaged' ? -Math.abs(Number(quantity))
      : Number(quantity);
    if (!Number.isInteger(signed) || signed === 0) throw new ApiError(400, 'Quantity must be a non-zero integer');

    const newStock = await inventoryService.applyStockChange({
      businessId: req.user.businessId, productId, type, quantity: signed,
      referenceType: 'manual', note, createdBy: req.user.id,
    });
    await inventoryService.checkLowStock(req.user.businessId, productId);
    res.json({ success: true, newStock });
  } catch (err) { next(err); }
}

module.exports = {
  listCategories, createCategory, updateCategory, deleteCategory,
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  inventoryOverview, inventoryHistory, adjustStock,
};
