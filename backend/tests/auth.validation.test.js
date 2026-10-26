// FR-01/FR-02 + integration smoke test against a scratch SQLite DB.
// Tests ALWAYS use SQLite regardless of the active .env (DB_DIALECT=postgres),
// so `npm test` can never wipe the real PostgreSQL database.
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = './data/test.sqlite';
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const bcrypt = require('bcryptjs');

const { sequelize, User, Business, Product, Category, Customer, Inventory } = require('../src/models');

let app;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  app = require('../src/app');
});

afterAll(async () => { await sequelize.close(); });

describe('auth (FR-01, FR-02, NFR-05)', () => {
  test('registers a business + owner and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Owner', email: 'test@biz.dev', password: 'secret123', businessName: 'Test Shop',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('owner');

    // NFR-05: password must be hashed, never plain text
    const user = await User.findOne({ where: { email: 'test@biz.dev' } });
    expect(user.passwordHash).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', user.passwordHash)).toBe(true);
  });

  test('rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Dup', email: 'test@biz.dev', password: 'secret123', businessName: 'Dup Shop',
    });
    expect(res.status).toBe(409);
  });

  test('rejects invalid credentials (FR-02)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@biz.dev', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  test('blocks protected routes without a token (29.6)', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });
});

describe('RBAC (FR-03, BR-04)', () => {
  let ownerToken, staffToken;

  beforeAll(async () => {
    ownerToken = (await request(app).post('/api/auth/login').send({ email: 'test@biz.dev', password: 'secret123' })).body.token;
    const bizId = (await User.findOne({ where: { email: 'test@biz.dev' } })).businessId;
    await User.create({
      businessId: bizId, name: 'Staff', email: 'staff@biz.dev',
      passwordHash: await bcrypt.hash('secret123', 10), role: 'staff',
    });
    staffToken = (await request(app).post('/api/auth/login').send({ email: 'staff@biz.dev', password: 'secret123' })).body.token;
  });

  test('staff cannot open financial reports (BR-04)', async () => {
    const res = await request(app).get('/api/analytics/profit').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
    const ok = await request(app).get('/api/analytics/profit').set('Authorization', `Bearer ${ownerToken}`);
    expect(ok.status).toBe(200);
  });

  test('staff cannot manage employees', async () => {
    const res = await request(app).post('/api/users').set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'X', email: 'x@biz.dev', password: 'secret123', role: 'staff' });
    expect(res.status).toBe(403);
  });
});

describe('products + inventory (FR-05..FR-10, BR-02)', () => {
  let token, businessId;

  beforeAll(async () => {
    token = (await request(app).post('/api/auth/login').send({ email: 'test@biz.dev', password: 'secret123' })).body.token;
    businessId = (await User.findOne({ where: { email: 'test@biz.dev' } })).businessId;
  });

  test('creates product with initial stock and logs inventory transaction', async () => {
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Shirt', sku: 'TS-1', sellingPrice: 500, costPrice: 200, initialStock: 10, reorderLevel: 3 });
    expect(res.status).toBe(201);

    const inv = await Inventory.findOne({ where: { productId: res.body.product.id } });
    expect(inv.currentStock).toBe(10);

    const history = await request(app).get(`/api/products/${res.body.product.id}`).set('Authorization', `Bearer ${token}`);
    expect(history.body.inventoryHistory).toHaveLength(1);
    expect(history.body.inventoryHistory[0].type).toBe('initial');
  });

  test('BR-02: stock cannot go negative via adjust', async () => {
    const product = (await request(app).get('/api/products').set('Authorization', `Bearer ${token}`)).body.products[0];
    const res = await request(app).post('/api/inventory/adjust').set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, type: 'damaged', quantity: 999 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);
  });

  test('FR-07: delete soft-deactivates', async () => {
    const product = (await request(app).get('/api/products').set('Authorization', `Bearer ${token}`)).body.products[0];
    const res = await request(app).delete(`/api/products/${product.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const row = await Product.findByPk(product.id);
    expect(row.isActive).toBe(false);
  });
});

describe('order lifecycle via API (FR-13/14, BR-01)', () => {
  let token, customerId, productId;

  beforeAll(async () => {
    token = (await request(app).post('/api/auth/login').send({ email: 'test@biz.dev', password: 'secret123' })).body.token;
    const businessId = (await User.findOne({ where: { email: 'test@biz.dev' } })).businessId;
    const cat = await Category.create({ businessId, name: 'Cat' });
    const prod = await Product.create({ businessId, categoryId: cat.id, name: 'P', sku: 'SKU-2', sellingPrice: 100, costPrice: 40, reorderLevel: 2, initialStock: 0 });
    await Inventory.create({ businessId, productId: prod.id, currentStock: 50 });
    productId = prod.id;
    const cust = await Customer.create({ businessId, name: 'Cust', phone: '01700000000' });
    customerId = cust.id;
  });

  test('create -> confirm deducts stock -> cancel restores it', async () => {
    const created = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`)
      .send({ customerId, items: [{ productId, quantity: 5 }], deliveryCharge: 60 });
    expect(created.status).toBe(201);
    const orderId = created.body.order.id;

    const before = (await Inventory.findOne({ where: { productId } })).currentStock;

    const confirmed = await request(app).put(`/api/orders/${orderId}`).set('Authorization', `Bearer ${token}`).send({ status: 'confirmed' });
    expect(confirmed.status).toBe(200);
    expect((await Inventory.findOne({ where: { productId } })).currentStock).toBe(before - 5);

    // BR-01: cannot deliver an unshipped order
    const badDeliver = await request(app).put(`/api/orders/${orderId}`).set('Authorization', `Bearer ${token}`).send({ status: 'delivered' });
    expect(badDeliver.status).toBe(400);

    const cancelled = await request(app).put(`/api/orders/${orderId}`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled', reason: 'customer_changed_mind' });
    expect(cancelled.status).toBe(200);
    expect((await Inventory.findOne({ where: { productId } })).currentStock).toBe(before);
  });

  test('BR-02: order cannot oversell', async () => {
    const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`)
      .send({ customerId, items: [{ productId, quantity: 9999 }], initialStatus: 'confirmed' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);
  });

  test('full happy path: pending -> delivered -> return restocks (BR-05)', async () => {
    const created = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`)
      .send({ customerId, items: [{ productId, quantity: 4 }], deliveryCharge: 60 });
    const orderId = created.body.order.id;
    for (const status of ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered']) {
      const r = await request(app).put(`/api/orders/${orderId}`).set('Authorization', `Bearer ${token}`).send({ status });
      expect(r.status).toBe(200);
    }
    const afterDeliver = (await Inventory.findOne({ where: { productId } })).currentStock;

    const ret = await request(app).post(`/api/orders/${orderId}/returns`).set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId, quantity: 4, reason: 'size_issue', condition: 'resellable' }] });
    expect(ret.status).toBe(200);
    expect(ret.body.order.status).toBe('returned');
    expect((await Inventory.findOne({ where: { productId } })).currentStock).toBe(afterDeliver + 4);
  });
});
