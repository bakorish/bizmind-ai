// Unit tests for the FR-22 profit formula (SRS section 35: profit calculation).
const { computeProfit, orderRevenue } = require('../src/utils/profit');

const order = (over = {}) => ({
  status: 'delivered',
  subtotal: 1000,
  discount: 100,
  items: [{ unitCost: 400, quantity: 2 }], // cost 800
  payments: [{ courierCharge: 60 }],
  ...over,
});

describe('orderRevenue (FR-21)', () => {
  test('revenue = subtotal - discount', () => {
    expect(orderRevenue(order())).toBe(900);
  });

  test('revenue never negative', () => {
    expect(orderRevenue(order({ subtotal: 50, discount: 100 }))).toBe(0);
  });
});

describe('computeProfit (FR-22)', () => {
  test('profit = revenue - product cost - delivery cost - other expenses', () => {
    const p = computeProfit({
      orders: [order()],
      returns: [],
      expenses: [{ amount: 50 }],
    });
    // 900 - 800 - 60 - 0 - 50 = -10
    expect(p.revenue).toBe(900);
    expect(p.productCost).toBe(800);
    expect(p.deliveryCost).toBe(60);
    expect(p.otherExpenses).toBe(50);
    expect(p.profit).toBe(-10);
  });

  test('returns reverse revenue and add return charge', () => {
    const p = computeProfit({
      orders: [order()],
      returns: [{ itemValue: 450, itemCost: 400, returnCharge: 60, condition: 'resellable' }],
      expenses: [],
    });
    // net revenue 450, cost 800, delivery 60, return charge 60 -> profit = 450-800-60-60 = -470
    expect(p.revenue).toBe(450);
    expect(p.returnCost).toBe(60);
    expect(p.profit).toBe(-470);
  });

  test('damaged returns lose the product cost too', () => {
    const p = computeProfit({
      orders: [order()],
      returns: [{ itemValue: 450, itemCost: 400, returnCharge: 60, condition: 'damaged' }],
      expenses: [],
    });
    expect(p.returnCost).toBe(60 + 400);
    expect(p.profit).toBe(-870);
  });

  test('margin is percentage of net revenue', () => {
    const p = computeProfit({
      orders: [{ status: 'delivered', subtotal: 1000, discount: 0, items: [{ unitCost: 600, quantity: 1 }], payments: [{}] }],
      returns: [],
      expenses: [],
    });
    expect(p.profit).toBe(400);
    expect(p.margin).toBe(40);
  });

  test('cancelled / pending orders are excluded (revenue only from completed sales)', () => {
    const p = computeProfit({
      orders: [order({ status: 'cancelled' }), order({ status: 'pending' }), order()],
      returns: [],
      expenses: [],
    });
    expect(p.revenue).toBe(900);
  });
});
