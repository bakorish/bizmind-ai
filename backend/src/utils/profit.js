// FR-22: Profit = Revenue - Product Cost - Delivery Cost - Return Cost - Discounts - Other Expenses.
// Pure functions so they are directly unit-testable (SRS section 35: unit testing of
// profit calculation).
//
// Inputs are "snapshots": each delivered order contributes revenue (subtotal less
// discount), product cost (sum of unit_cost x qty) and delivery cost (courier charge).
// Returned items reverse their revenue/cost and add return charges.

function orderRevenue(order) {
  const gross = Number(order.subtotal || 0);
  const discount = Number(order.discount || 0);
  return Math.max(gross - discount, 0);
}

/**
 * Compute profit for a set of orders + returns + expenses.
 * @param {Array} orders  orders with items, payments (delivery courier charge)
 * @param {Array} returns return records (quantity, product value, condition, returnCharge)
 * @param {Array} expenses recorded expenses in period
 */
function computeProfit({ orders = [], returns = [], expenses = [] }) {
  const delivered = orders.filter((o) => o.status === 'delivered' || o.status === 'returned');

  let revenue = 0;
  let productCost = 0;
  let deliveryCost = 0;

  for (const order of delivered) {
    revenue += orderRevenue(order);
    for (const item of order.items || []) {
      productCost += Number(item.unitCost || 0) * item.quantity;
    }
    const payment = (order.payments || [])[0] || order;
    deliveryCost += Number(payment.courierCharge ?? order.courierCharge ?? 0);
  }

  let returnCost = 0;
  let returnedRevenue = 0;
  for (const ret of returns) {
    returnedRevenue += Number(ret.itemValue || 0);
    returnCost += Number(ret.returnCharge || 0);
    if (ret.condition === 'damaged') {
      // Damaged returns cannot be resold: the product cost of those units is lost.
      returnCost += Number(ret.itemCost || 0);
    }
  }

  const netRevenue = Math.max(revenue - returnedRevenue, 0);
  const otherExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const profit = netRevenue - productCost - deliveryCost - returnCost - otherExpenses;

  return {
    revenue: round2(netRevenue),
    grossRevenue: round2(revenue),
    returnedRevenue: round2(returnedRevenue),
    productCost: round2(productCost),
    deliveryCost: round2(deliveryCost),
    returnCost: round2(returnCost),
    otherExpenses: round2(otherExpenses),
    profit: round2(profit),
    margin: netRevenue > 0 ? round2((profit / netRevenue) * 100) : 0,
  };
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = { computeProfit, orderRevenue, round2 };
