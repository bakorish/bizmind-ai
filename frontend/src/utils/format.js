export const money = (n, currency = '৳') =>
  `${currency}${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const pct = (n) => (n == null ? '—' : `${n > 0 ? '+' : ''}${Number(n).toFixed(1)}%`);

export const dateShort = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

export const dateTime = (d) =>
  new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const STATUS_META = {
  pending:          { label: 'Pending',           chip: 'bg-amber-100 text-amber-800' },
  confirmed:        { label: 'Confirmed',         chip: 'bg-blue-100 text-blue-800' },
  processing:       { label: 'Processing',        chip: 'bg-indigo-100 text-indigo-800' },
  shipped:          { label: 'Shipped',           chip: 'bg-violet-100 text-violet-800' },
  out_for_delivery: { label: 'Out for Delivery',  chip: 'bg-cyan-100 text-cyan-800' },
  delivered:        { label: 'Delivered',         chip: 'bg-emerald-100 text-emerald-800' },
  cancelled:        { label: 'Cancelled',         chip: 'bg-rose-100 text-rose-800' },
  returned:         { label: 'Returned',          chip: 'bg-orange-100 text-orange-800' },
};

export const PAY_METHOD_LABEL = {
  cod: 'Cash on Delivery', bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket',
  card: 'Card', bank_transfer: 'Bank Transfer',
};

export const CANCEL_REASONS = {
  customer_changed_mind: 'Customer changed mind', incorrect_product: 'Incorrect product',
  incorrect_address: 'Incorrect address', customer_unreachable: 'Customer unreachable',
  delivery_delay: 'Delivery delay', price_too_high: 'Price too high', other: 'Other',
};

export const RETURN_REASONS = {
  size_issue: 'Size issue', did_not_like: 'Did not like', wrong_item_shipped: 'Wrong item shipped',
  damaged_in_delivery: 'Damaged in delivery', quality_not_expected: 'Quality not as expected',
  changed_mind: 'Changed mind', other: 'Other',
};

export const titleize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
