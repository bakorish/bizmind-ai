/**
 * Demo data seeder — generates a realistic Bangladeshi online fashion business
 * ("GhorerBazaar BD") with ~10 months of order history so analytics and the AI
 * models have meaningful training data (BR-06).
 *
 * Deterministic PRNG (mulberry32) keeps every reseed identical.
 */
const bcrypt = require('bcryptjs');
const { sequelize } = require('../models');
const {
  Business, User, Category, Product, Customer, Order, OrderItem,
  Inventory, InventoryTransaction, Payment, ReturnRecord, Cancellation,
  Delivery, Expense,
} = require('../models');

// ---------- PRNG ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20251007);
const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;

const AREAS = ['Dhanmondi', 'Gulshan', 'Mirpur', 'Uttara', 'Banani', 'Mohakhali', 'Bashundhara', 'Motijheel', 'Chattogram', 'Sylhet', 'Khulna', 'Rajshahi'];
const FIRST = ['Nusrat', 'Tanvir', 'Sadia', 'Rakib', 'Mehedi', 'Farhana', 'Arif', 'Sumaiya', 'Jubayer', 'Tasnim', 'Imran', 'Anika', 'Shakib', 'Mim', 'Rafi', 'Nabila', 'Hasan', 'Rumana', 'Fahim', 'Ishrat'];
const LAST = ['Akter', 'Hossain', 'Islam', 'Rahman', 'Chowdhury', 'Karim', 'Sultana', 'Ahmed', 'Mahmud', 'Jahan', 'Sarker', 'Bhuiyan'];
const name = () => `${pick(FIRST)} ${pick(LAST)}`;
const phone = () => `01${pick(['3', '5', '6', '7', '8', '9'])}${String(ri(10000000, 99999999))}`;

const CATEGORIES = [
  { name: 'T-Shirts', products: [
    { name: 'Black Premium T-Shirt', sku: 'TS-BLK-001', cost: 210, price: 450, pop: 1.0, ret: 0.10 },
    { name: 'White Cotton T-Shirt', sku: 'TS-WHT-002', cost: 200, price: 420, pop: 0.9, ret: 0.09 },
    { name: 'Navy Oversized Tee', sku: 'TS-NVY-003', cost: 260, price: 590, pop: 0.7, ret: 0.12 },
    { name: 'Olive Graphic Tee', sku: 'TS-OLV-004', cost: 240, price: 520, pop: 0.5, ret: 0.11 },
  ]},
  { name: 'Panjabi', products: [
    { name: 'White Cotton Panjabi', sku: 'PJ-WHT-001', cost: 680, price: 1450, pop: 0.9, ret: 0.14 },
    { name: 'Slim Fit Panjabi (Sky)', sku: 'PJ-SKY-002', cost: 750, price: 1650, pop: 0.6, ret: 0.15 },
    { name: 'Festival Embroidered Panjabi', sku: 'PJ-EMB-003', cost: 950, price: 2200, pop: 0.8, ret: 0.13 },
  ]},
  { name: 'Women Wear', products: [
    { name: 'Three-Piece (Red)', sku: 'WM-3PC-001', cost: 850, price: 1850, pop: 1.0, ret: 0.18 },
    { name: 'Three-Piece (Navy)', sku: 'WM-3PC-002', cost: 820, price: 1750, pop: 0.8, ret: 0.17 },
    { name: 'Kurti (Yellow)', sku: 'WM-KRT-003', cost: 420, price: 950, pop: 0.7, ret: 0.15 },
    { name: 'Abaya (Black)', sku: 'WM-ABY-004', cost: 1100, price: 2400, pop: 0.4, ret: 0.10 },
  ]},
  { name: 'Accessories', products: [
    { name: 'Leather Belt (Brown)', sku: 'AC-BLT-001', cost: 180, price: 450, pop: 0.5, ret: 0.05 },
    { name: 'Sports Cap', sku: 'AC-CAP-002', cost: 120, price: 320, pop: 0.4, ret: 0.04 },
    { name: 'Cotton Scarf', sku: 'AC-SCF-003', cost: 90, price: 250, pop: 0.6, ret: 0.06 },
    { name: 'Sunglasses Classic', sku: 'AC-SUN-004', cost: 220, price: 550, pop: 0.3, ret: 0.08 },
  ]},
  { name: 'Footwear', products: [
    { name: 'Casual Loafers', sku: 'FW-LFR-001', cost: 550, price: 1200, pop: 0.6, ret: 0.20 },
    { name: 'Sports Sneakers', sku: 'FW-SNK-002', cost: 750, price: 1650, pop: 0.7, ret: 0.19 },
    { name: 'Leather Sandals', sku: 'FW-SND-003', cost: 380, price: 850, pop: 0.5, ret: 0.16 },
  ]},
];

const RETURN_REASONS = ['size_issue', 'did_not_like', 'wrong_item_shipped', 'damaged_in_delivery', 'quality_not_expected', 'changed_mind'];
const CANCEL_REASONS = ['customer_changed_mind', 'customer_unreachable', 'delivery_delay', 'incorrect_address', 'incorrect_product', 'price_too_high'];
const PAY_METHODS = [
  { m: 'cod', w: 0.78 }, { m: 'bkash', w: 0.12 }, { m: 'nagad', w: 0.06 }, { m: 'card', w: 0.04 },
];
const VIA = ['facebook', 'instagram', 'website', 'phone', 'direct'];

function pickMethod() {
  const r = rand(); let acc = 0;
  for (const pm of PAY_METHODS) { acc += pm.w; if (r <= acc) return pm.m; }
  return 'cod';
}

async function main() {
  console.log('Seeding BizMind AI demo data ...');
  await sequelize.sync({ force: true });

  // ---------- Business + users ----------
  const business = await Business.create({
    name: 'GhorerBazaar BD',
    currency: 'BDT',
    email: 'hello@stylebazaar.bd',
    phone: '+8801711000000',
    address: 'House 12, Road 5, Dhanmondi, Dhaka 1205',
    settings: { lowStockNotify: true, defaultLeadTimeDays: 7, safetyStockDays: 5 },
  });
  const hash = await bcrypt.hash('password123', 10);
  const owner = await User.create({ businessId: business.id, name: 'Md. Abu Bakor', email: 'owner@bizmind.dev', phone: '01711000001', passwordHash: hash, role: 'owner' });
  const manager = await User.create({ businessId: business.id, name: 'Sadia Islam', email: 'manager@bizmind.dev', phone: '01711000002', passwordHash: hash, role: 'manager' });
  const staff = await User.create({ businessId: business.id, name: 'Naziur Rahman Raju', email: 'staff@bizmind.dev', phone: '01711000003', passwordHash: hash, role: 'staff' });
  await User.create({ businessId: null, name: 'Platform Admin', email: 'admin@bizmind.dev', passwordHash: hash, role: 'admin' });

  // ---------- Catalog ----------
  const products = [];
  for (const cat of CATEGORIES) {
    const category = await Category.create({ businessId: business.id, name: cat.name, description: `${cat.name} collection` });
    for (const p of cat.products) {
      const product = await Product.create({
        businessId: business.id, categoryId: category.id,
        name: p.name, sku: p.sku, description: `${p.name} — quality guaranteed.`,
        sellingPrice: p.price, costPrice: p.cost,
        reorderLevel: ri(8, 18), leadTimeDays: pick([5, 7, 10, 14]), unit: 'pcs',
        initialStock: 0,
      });
      products.push({ ...p, id: product.id, product });
    }
  }
  const totalPop = products.reduce((s, p) => s + p.pop, 0);
  function pickProduct() {
    const r = rand() * totalPop; let acc = 0;
    for (const p of products) { acc += p.pop; if (r <= acc) return p; }
    return products[0];
  }

  // ---------- Customers ----------
  const customers = [];
  for (let i = 0; i < 65; i++) {
    const c = await Customer.create({
      businessId: business.id, name: name(), phone: phone(),
      email: chance(0.5) ? `customer${i}@mail.com` : null,
      address: `House ${ri(1, 80)}, Road ${ri(1, 20)}, ${pick(AREAS)}`,
      city: chance(0.7) ? 'Dhaka' : pick(['Chattogram', 'Sylhet', 'Khulna', 'Rajshahi']),
    });
    // 20% of customers are chronically-returning customers (risk model signal).
    customers.push({ ...c.toJSON(), risky: chance(0.2), ordersCount: 0, deliveries: 0, returns: 0, cancels: 0 });
  }

  // ---------- Order history: ~10 months ----------
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const START_MONTHS_AGO = 10;
  const start = new Date(today.getFullYear(), today.getMonth() - START_MONTHS_AGO, 1);

  // growth trend: monthly volume multiplier from 0.55 -> 1.35
  const monthVolume = (m) => 0.55 + (m / START_MONTHS_AGO) * 0.8;

  let orderSeq = 0;
  const stockDelta = {}; // productId -> net change (sold negative, returns positive)
  products.forEach((p) => { stockDelta[p.id] = 0; });
  const unitsSoldPerProduct = {};

  // walk day by day from start to today-5 (history closes 5 days before today)
  const histEnd = new Date(today); histEnd.setDate(histEnd.getDate() - 5);

  const allOrdersMeta = [];

  for (let d = new Date(start); d <= histEnd; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    const monthIdx = (day.getFullYear() - start.getFullYear()) * 12 + (day.getMonth() - start.getMonth());
    const dow = day.getDay(); // Fri(5)/Sat(6) peak in BD
    const dowMult = [0.85, 0.9, 0.95, 1.0, 1.1, 1.35, 1.25][dow];
    // Eid-ish spike in some months (2 spikes)
    const spike = (day.getMonth() === 2 && day.getDate() > 20) || (day.getMonth() === 7 && day.getDate() > 15) ? 1.6 : 1.0;
    const noise = 0.75 + rand() * 0.5;
    const base = 5.2 * monthVolume(monthIdx) * dowMult * spike * noise;
    const nOrders = Math.max(0, Math.round(base));

    for (let i = 0; i < nOrders; i++) {
      const customer = pick(customers);
      customer.ordersCount += 1;

      const nItems = chance(0.62) ? 1 : chance(0.8) ? 2 : 3;
      const chosen = new Map();
      for (let k = 0; k < nItems; k++) {
        const p = pickProduct();
        chosen.set(p.id, (chosen.get(p.id) || 0) + ri(1, 2));
      }

      const items = [...chosen.entries()].map(([pid, qty]) => {
        const p = products.find((x) => x.id === pid);
        return { p, qty, unitPrice: Number(p.price), unitCost: Number(p.cost), lineTotal: p.price * qty };
      });
      const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
      const discount = chance(0.22) ? Math.round(subtotal * pick([0.05, 0.08, 0.1])) : 0;
      const isDhaka = customer.city === 'Dhaka';
      const deliveryCharge = isDhaka ? 60 : 100 + ri(0, 20);
      const courierCharge = isDhaka ? 50 : 85;
      const total = subtotal - discount + deliveryCharge;
      const method = pickMethod();
      const placedAt = new Date(day); placedAt.setHours(ri(9, 22), ri(0, 59), 0, 0);

      orderSeq += 1;
      const orderNo = `BM-${placedAt.getFullYear()}-${String(orderSeq).padStart(5, '0')}`;

      // ---- lifecycle simulation ----
      // cancellation: base 6% (+3% risky customer, +4% high COD value > 3000)
      let cancelP = 0.06 + (customer.risky ? 0.03 : 0) + (method === 'cod' && total > 3000 ? 0.04 : 0);
      // delivery takes 2-5 days
      const deliveryDays = ri(2, 5);

      let status;
      let cancelledAtStage = null;
      if (chance(cancelP)) {
        status = 'cancelled';
        cancelledAtStage = pick(['pending', 'confirmed', 'processing']);
      } else {
        status = 'delivered';
      }

      const deliveredAt = status === 'delivered' ? new Date(placedAt.getTime() + deliveryDays * 86400000) : null;

      // returns after delivery
      let returns = [];
      let fullReturn = false;
      if (status === 'delivered') {
        customer.deliveries += 1;
        let returnP = items.reduce((s, it) => s + it.p.ret, 0) / items.length; // avg product return rate
        if (customer.risky) returnP += 0.12;
        if (method === 'cod' && total > 2500) returnP += 0.05;
        if (chance(returnP)) {
          const retItem = pick(items);
          const retQty = retItem.qty === 2 && chance(0.4) ? 1 : retItem.qty;
          returns.push({ item: retItem, qty: retQty, reason: pick(RETURN_REASONS), condition: chance(0.75) ? 'resellable' : 'damaged' });
          customer.returns += 1;
          fullReturn = returns[0].qty === retItem.qty && items.length === 1 && chance(0.7);
        }
      }

      const finalStatus = fullReturn ? 'returned' : status;
      const returnedAt = fullReturn ? new Date(deliveredAt.getTime() + ri(1, 4) * 86400000) : null;

      // ---------- persist order ----------
      const order = await Order.create({
        businessId: business.id, orderNo, customerId: customer.id,
        status: finalStatus, orderDate: placedAt,
        subtotal, discount, deliveryCharge, total,
        paymentMethod: method,
        paymentStatus: finalStatus === 'cancelled' ? 'pending'
          : fullReturn ? 'refunded'
          : status === 'delivered' ? 'paid' : 'pending',
        placedVia: pick(VIA),
        shippingAddress: customer.address,
        deliveredAt, cancelledAt: finalStatus === 'cancelled' ? new Date(placedAt.getTime() + ri(1, 36) * 3600000) : null,
        returnedAt,
        createdById: chance(0.5) ? owner.id : chance(0.5) ? manager.id : staff.id,
      });

      for (const it of items) {
        await OrderItem.create({
          orderId: order.id, productId: it.p.id, productName: it.p.name,
          quantity: it.qty, unitPrice: it.unitPrice, unitCost: it.unitCost, lineTotal: it.lineTotal,
        });
      }

      // payment row
      const collected = status === 'delivered' && method === 'cod' ? total : status === 'delivered' ? total : 0;
      const returnCharge = returns.length && method === 'cod' ? 60 + (isDhaka ? 0 : 30) : 0;
      await Payment.create({
        businessId: business.id, orderId: order.id, method,
        status: finalStatus === 'cancelled' ? 'pending' : fullReturn ? 'refunded' : status === 'delivered' ? 'paid' : 'pending',
        amount: total, deliveryCharge, courierCharge,
        collectedAmount: collected, returnCharge,
        paidOn: status === 'delivered' ? deliveredAt : null,
      });

      // delivery row for shipped+
      if (status === 'delivered') {
        await Delivery.create({
          businessId: business.id, orderId: order.id,
          courierName: pick(['Steadfast', 'Pathao', 'RedX', 'In-house']),
          trackingCode: `SF${ri(100000, 999999)}`,
          address: customer.address, city: customer.city,
          deliveryCharge, courierCharge, status: fullReturn ? 'returned' : 'delivered',
          shippedAt: new Date(placedAt.getTime() + 86400000), deliveredAt,
        });
      }

      // cancellation record
      if (finalStatus === 'cancelled') {
        await Cancellation.create({
          businessId: business.id, orderId: order.id,
          reason: method === 'cod' && total > 3000 ? pick(['customer_changed_mind', 'customer_unreachable'])
            : pick(CANCEL_REASONS),
          stage: cancelledAtStage,
          cancelledOn: new Date(placedAt.getTime() + ri(1, 48) * 3600000),
          byUserId: staff.id,
        });
        customer.cancels += 1;
      }

      // return records
      for (const r of returns) {
        await ReturnRecord.create({
          businessId: business.id, orderId: order.id, productId: r.item.p.id,
          quantity: r.qty, reason: r.reason,
          refundStatus: fullReturn ? 'refunded' : 'refunded',
          refundAmount: r.qty * r.item.unitPrice,
          condition: r.condition,
          returnDate: returnedAt || new Date(deliveredAt.getTime() + ri(1, 4) * 86400000),
        });
      }

      // ---------- inventory effect ----------
      const stockDeducted = ['confirmed', 'processing'].includes(cancelledAtStage) || status === 'delivered';
      if (stockDeducted) {
        for (const it of items) {
          stockDelta[it.p.id] -= it.qty;
          unitsSoldPerProduct[it.p.id] = (unitsSoldPerProduct[it.p.id] || 0) + it.qty;
        }
        for (const r of returns) {
          if (r.condition === 'resellable') stockDelta[r.item.p.id] += r.qty;
        }
      }

      allOrdersMeta.push({ id: order.id, finalStatus, placedAt, method, total, customerId: customer.id });
    }
  }

  // ---------- recent open orders (last 5 days) ----------
  const recentStart = new Date(today); recentStart.setDate(recentStart.getDate() - 5);
  const OPEN_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery'];
  for (let d = new Date(recentStart); d <= today; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    for (let i = 0; i < ri(3, 7); i++) {
      const customer = pick(customers);
      customer.ordersCount += 1;
      const p = pickProduct();
      const qty = ri(1, 2);
      const subtotal = p.price * qty;
      const discount = chance(0.15) ? Math.round(subtotal * 0.05) : 0;
      const isDhaka = customer.city === 'Dhaka';
      const deliveryCharge = isDhaka ? 60 : 100;
      const total = subtotal - discount + deliveryCharge;
      const method = pickMethod();
      const placedAt = new Date(day); placedAt.setHours(ri(9, 22), ri(0, 59), 0, 0);
      orderSeq += 1;
      const orderNo = `BM-${placedAt.getFullYear()}-${String(orderSeq).padStart(5, '0')}`;

      // newer orders are earlier in the pipeline; yesterday-to-4-days-ago
      // orders can already be delivered (delivered revenue for the week)
      const daysAgo = Math.round((today - day) / 86400000);
      let statusPool = ['pending', 'confirmed'];
      if (daysAgo >= 4) statusPool = OPEN_STATUSES;
      else if (daysAgo >= 2) statusPool = ['pending', 'confirmed', 'processing', 'shipped'];
      const status = chance(daysAgo >= 1 ? 0.55 : 0) ? 'delivered' : pick(statusPool);

      const order = await Order.create({
        businessId: business.id, orderNo, customerId: customer.id,
        status, orderDate: placedAt, subtotal, discount, deliveryCharge, total,
        paymentMethod: method,
        paymentStatus: status === 'delivered' ? 'paid' : 'pending',
        placedVia: pick(VIA), shippingAddress: customer.address,
        deliveredAt: status === 'delivered' ? new Date(placedAt.getTime() + ri(1, 2) * 86400000) : null,
        createdById: pick([owner.id, manager.id, staff.id]),
      });
      await OrderItem.create({
        orderId: order.id, productId: p.id, productName: p.name,
        quantity: qty, unitPrice: p.price, unitCost: p.cost, lineTotal: subtotal,
      });
      await Payment.create({
        businessId: business.id, orderId: order.id, method,
        status: status === 'delivered' ? 'paid' : 'pending',
        amount: total, deliveryCharge, courierCharge: isDhaka ? 50 : 85,
        collectedAmount: status === 'delivered' && method === 'cod' ? total : 0,
        paidOn: status === 'delivered' ? placedAt : null,
      });
      if (['shipped', 'out_for_delivery', 'delivered'].includes(status)) {
        await Delivery.create({
          businessId: business.id, orderId: order.id,
          courierName: pick(['Steadfast', 'Pathao', 'RedX']),
          trackingCode: `SF${ri(100000, 999999)}`,
          address: customer.address, city: customer.city,
          deliveryCharge, courierCharge: isDhaka ? 50 : 85, status,
          shippedAt: new Date(placedAt.getTime() + 86400000),
          deliveredAt: status === 'delivered' ? new Date(placedAt.getTime() + 2 * 86400000) : null,
        });
      }
      if (status !== 'pending') {
        stockDelta[p.id] -= qty;
        unitsSoldPerProduct[p.id] = (unitsSoldPerProduct[p.id] || 0) + qty;
      }
    }
  }

  // ---------- inventory: initial stock sized to cover simulated demand + headroom ----------
  for (const p of products) {
    const sold = unitsSoldPerProduct[p.id] || 0;
    const initialStock = Math.ceil(sold * 1.35) + Number(p.product.reorderLevel) + ri(10, 30);
    const finalStock = initialStock + stockDelta[p.id];
    // A couple of deliberately low-stock products so FR-09 alerts are visible.
    const forceLow = ['FW-LFR-001', 'WM-3PC-001'].includes(p.sku);
    await Inventory.create({ businessId: business.id, productId: p.id, currentStock: forceLow ? ri(2, 6) : finalStock });
    await InventoryTransaction.create({
      businessId: business.id, productId: p.id, type: 'initial', quantity: initialStock,
      balanceAfter: initialStock, referenceType: 'product_create', referenceId: p.id,
    });
    if (forceLow) {
      await InventoryTransaction.create({
        businessId: business.id, productId: p.id, type: 'sold', quantity: -(initialStock - ri(2, 6)),
        balanceAfter: ri(2, 6), referenceType: 'order', note: 'Sales surge',
      });
    }
  }

  // ---------- monthly expenses (marketing/packaging/transport) ----------
  for (let m = START_MONTHS_AGO; m >= 0; m--) {
    const when = new Date(today.getFullYear(), today.getMonth() - m, ri(2, 25));
    await Expense.create({ businessId: business.id, category: 'marketing', amount: ri(2500, 8000), description: 'Facebook/Instagram ads boost', expenseDate: when });
    await Expense.create({ businessId: business.id, category: 'packaging', amount: ri(1200, 3000), description: 'Poly bags, boxes, tape', expenseDate: when });
    if (chance(0.7)) await Expense.create({ businessId: business.id, category: 'transport', amount: ri(600, 1800), description: 'Courier pickup transport', expenseDate: when });
  }

  const counts = {
    products: products.length,
    customers: customers.length,
    orders: await Order.count(),
    items: await OrderItem.count(),
    returns: await ReturnRecord.count(),
    cancellations: await Cancellation.count(),
    expenses: await Expense.count(),
  };
  console.log('Seed complete:', counts);
  console.log('\nDemo accounts (password: password123):');
  console.log('  owner@bizmind.dev    (owner)  — full access');
  console.log('  manager@bizmind.dev  (manager)');
  console.log('  staff@bizmind.dev    (staff)');
  console.log('  admin@bizmind.dev    (platform admin)');
  await sequelize.close();
}

main().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
