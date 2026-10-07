// BR-01 / BR-02 / BR-05: order lifecycle rules.
const { assertTransition } = require('../src/services/orderService');
const { STATUS_TRANSITIONS } = require('../src/models/order');

describe('order status workflow (BR-01)', () => {
  test('pending -> confirmed allowed', () => {
    expect(() => assertTransition('pending', 'confirmed')).not.toThrow();
  });

  test('delivered requires passing through shipped (cannot deliver from pending)', () => {
    expect(() => assertTransition('pending', 'delivered')).toThrow(/Invalid status transition/);
    expect(() => assertTransition('confirmed', 'delivered')).toThrow(/Invalid status transition/);
    expect(() => assertTransition('shipped', 'out_for_delivery')).not.toThrow();
    expect(() => assertTransition('out_for_delivery', 'delivered')).not.toThrow();
  });

  test('cancellation only before shipping', () => {
    expect(() => assertTransition('pending', 'cancelled')).not.toThrow();
    expect(() => assertTransition('confirmed', 'cancelled')).not.toThrow();
    expect(() => assertTransition('processing', 'cancelled')).not.toThrow();
    expect(() => assertTransition('shipped', 'cancelled')).toThrow(/Invalid status transition/);
  });

  test('returns only from delivered', () => {
    expect(() => assertTransition('delivered', 'returned')).not.toThrow();
    expect(() => assertTransition('pending', 'returned')).toThrow(/Invalid status transition/);
  });

  test('terminal states allow nothing', () => {
    expect(STATUS_TRANSITIONS.cancelled).toEqual([]);
    expect(STATUS_TRANSITIONS.returned).toEqual([]);
  });

  test('self-transition rejected', () => {
    expect(() => assertTransition('pending', 'pending')).toThrow(/already/);
  });
});
