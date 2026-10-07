const { Inventory, InventoryTransaction, Product, Notification } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const sequelize = require('../config/database');

/**
 * Apply a stock movement atomically and log it (FR-08, FR-10).
 * BR-02: stock may never go negative through a valid order — throws instead.
 */
async function applyStockChange({ businessId, productId, type, quantity, referenceType = 'manual', referenceId = null, note = null, createdBy = null }, transaction) {
  const tx = transaction || (await sequelize.transaction());
  const ownsTx = !transaction;
  try {
    const [inv] = await Inventory.findOrCreate({
      where: { productId },
      defaults: { businessId, productId, currentStock: 0 },
      transaction: tx,
    });

    const delta = Number(quantity); // signed
    const newStock = inv.currentStock + delta;
    if (newStock < 0) {
      throw new ApiError(400, `Insufficient stock for product ${productId}: have ${inv.currentStock}, need ${Math.abs(delta)}`);
    }

    inv.currentStock = newStock;
    await inv.save({ transaction: tx });

    await InventoryTransaction.create({
      businessId, productId, type, quantity: delta, balanceAfter: newStock,
      referenceType, referenceId, note, createdBy,
    }, { transaction: tx });

    if (ownsTx) await tx.commit();
    return newStock;
  } catch (err) {
    if (ownsTx) await tx.rollback();
    throw err;
  }
}

// FR-09: low stock detection + notification to business owners/managers.
async function checkLowStock(businessId, productId, transaction) {
  const product = await Product.findByPk(productId, { transaction });
  const inv = await Inventory.findOne({ where: { productId }, transaction });
  if (!product || !inv) return null;

  const isLow = inv.currentStock <= product.reorderLevel;
  const existing = await Notification.findOne({
    where: { businessId, type: 'low_stock', entityType: 'product', entityId: productId, isRead: false },
    transaction,
  });
  if (isLow && !existing) {
    await Notification.create({
      businessId, type: 'low_stock',
      title: `Low stock: ${product.name}`,
      message: `${product.name} — only ${inv.currentStock} ${product.unit} remaining (reorder level ${product.reorderLevel}).`,
      entityType: 'product', entityId: productId,
    }, { transaction });
  }
  return isLow;
}

async function getInventoryOverview(businessId) {
  return Product.findAll({
    where: { businessId, isActive: true },
    include: [{ model: Inventory, required: false }],
  }).then((products) =>
    products.map((p) => {
      const stock = p.Inventory ? p.Inventory.currentStock : 0;
      return {
        productId: p.id, name: p.name, sku: p.sku, unit: p.unit,
        currentStock: stock, reorderLevel: p.reorderLevel, leadTimeDays: p.leadTimeDays,
        stockValue: Math.round(stock * Number(p.costPrice) * 100) / 100,
        status: stock <= 0 ? 'out_of_stock' : stock <= p.reorderLevel ? 'low' : 'ok',
      };
    })
  );
}

module.exports = { applyStockChange, checkLowStock, getInventoryOverview };
