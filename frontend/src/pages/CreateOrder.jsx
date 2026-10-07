import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import client, { errMsg } from '../api/client';
import { Card, Spinner, Badge, Th, Td, Field, inputCls, btnPrimary, btnGhost, Modal } from '../components/ui';
import { money, PAY_METHOD_LABEL } from '../utils/format';

export default function CreateOrder() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    customerId: '', discount: 0, deliveryCharge: 60, paymentMethod: 'cod',
    courierName: 'Steadfast', courierCharge: 50, shippingAddress: '', notes: '',
    placedVia: 'direct', initialStatus: 'pending',
  });
  const [items, setItems] = useState([]); // {productId, name, qty, unitPrice, cost, stock}
  const [custModal, setCustModal] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      client.get('/products', { params: { includeInactive: false } }),
      client.get('/customers'),
    ]).then(([p, c]) => { setProducts(p.data.products); setCustomers(c.data.customers); })
      .catch((e) => alert(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  const customer = customers.find((c) => c.id === Number(form.customerId));

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
    const total = subtotal - Number(form.discount || 0) + Number(form.deliveryCharge || 0);
    return { subtotal, total };
  }, [items, form.discount, form.deliveryCharge]);

  const addItem = (p) => {
    if (items.some((i) => i.productId === p.id)) return;
    if (p.currentStock <= 0) { alert(`${p.name} is out of stock`); return; }
    setItems([...items, { productId: p.id, name: p.name, qty: 1, unitPrice: Number(p.sellingPrice), stock: p.currentStock }]);
  };
  const setQty = (id, qty) => {
    const it = items.find((i) => i.productId === id);
    if (qty > it.stock) { alert(`Only ${it.stock} in stock`); qty = it.stock; }
    setItems(items.map((i) => (i.productId === id ? { ...i, qty } : i)));
  };

  const addCustomer = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      const { data } = await client.post('/customers', payload);
      setCustomers([data.customer, ...customers]);
      setForm({ ...form, customerId: data.customer.id });
      setCustModal(false);
    } catch (err) { alert(errMsg(err)); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.customerId) return alert('Select a customer');
    if (!items.length) return alert('Add at least one product');
    try {
      const { data } = await client.post('/orders', {
        ...form,
        customerId: Number(form.customerId),
        discount: Number(form.discount || 0),
        deliveryCharge: Number(form.deliveryCharge || 0),
        courierCharge: Number(form.courierCharge || 0),
        items: items.map((i) => ({ productId: i.productId, quantity: i.qty, unitPrice: i.unitPrice })),
      });
      navigate(`/orders/${data.order.id}`);
    } catch (err) { alert(errMsg(err)); }
  };

  if (loading) return <Spinner />;

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()));

  return (
    <form onSubmit={submit} className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">New Order</h1>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} onClick={() => navigate('/orders')}>Cancel</button>
          <button className={btnPrimary}>Create Order — {money(totals.total)}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Customer & Delivery">
          <div className="p-5 space-y-4">
            <Field label="Customer">
              <div className="flex gap-2">
                <select className={inputCls} required value={form.customerId} onChange={(e) => {
                  const c = customers.find((x) => x.id === Number(e.target.value));
                  setForm({ ...form, customerId: e.target.value, shippingAddress: c?.address || '' });
                }}>
                  <option value="">— select customer —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
                </select>
                <button type="button" className={btnGhost + ' shrink-0'} onClick={() => setCustModal(true)}><UserPlus size={15} /></button>
              </div>
            </Field>
            {customer && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                {customer.completedOrders} completed · {customer.cancelledOrders} cancelled · {customer.returnedOrders} returned orders
              </div>
            )}
            <Field label="Shipping address"><input className={inputCls} value={form.shippingAddress} onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Payment method">
                <select className={inputCls} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  {Object.entries(PAY_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Order source">
                <select className={inputCls} value={form.placedVia} onChange={(e) => setForm({ ...form, placedVia: e.target.value })}>
                  {['direct', 'facebook', 'instagram', 'website', 'phone'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Delivery charge (৳)"><input type="number" min="0" className={inputCls} value={form.deliveryCharge} onChange={(e) => setForm({ ...form, deliveryCharge: e.target.value })} /></Field>
              <Field label="Courier charge (৳)"><input type="number" min="0" className={inputCls} value={form.courierCharge} onChange={(e) => setForm({ ...form, courierCharge: e.target.value })} /></Field>
              <Field label="Courier">
                <select className={inputCls} value={form.courierName} onChange={(e) => setForm({ ...form, courierName: e.target.value })}>
                  {['Steadfast', 'Pathao', 'RedX', 'In-house'].map((v) => <option key={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Create as">
                <select className={inputCls} value={form.initialStatus} onChange={(e) => setForm({ ...form, initialStatus: e.target.value })}>
                  <option value="pending">Pending (stock kept)</option>
                  <option value="confirmed">Confirmed (stock deducted now)</option>
                </select>
              </Field>
            </div>
            <Field label="Notes"><textarea rows={2} className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
        </Card>

        <Card title="Items" actions={<span className="text-xs text-slate-400">{items.length} item(s)</span>}>
          <div className="p-5 space-y-4">
            <input className={inputCls} placeholder="Search products to add…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-44 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
              {filtered.slice(0, 20).map((p) => (
                <button type="button" key={p.id} onClick={() => addItem(p)} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-indigo-50/60 text-left">
                  <span>
                    <span className="font-medium text-slate-700">{p.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{money(p.sellingPrice)}</span>
                  </span>
                  <Badge className={p.currentStock === 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}>{p.currentStock} left</Badge>
                </button>
              ))}
            </div>

            {items.length === 0 && <div className="text-center text-sm text-slate-400 py-4">No items yet — click a product above</div>}
            {items.length > 0 && (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-400 uppercase"><th className="py-1.5">Item</th><th>Qty</th><th>Price</th><th className="text-right">Total</th><th /></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((it) => (
                    <tr key={it.productId}>
                      <td className="py-2 font-medium text-slate-700">{it.name}</td>
                      <td><input type="number" min="1" max={it.stock} value={it.qty} onChange={(e) => setQty(it.productId, Number(e.target.value))} className="w-16 border border-slate-300 rounded-md px-2 py-1 text-sm" /></td>
                      <td>{money(it.unitPrice)}</td>
                      <td className="text-right font-medium">{money(it.unitPrice * it.qty)}</td>
                      <td><button type="button" className="text-slate-300 hover:text-rose-500" onClick={() => setItems(items.filter((i) => i.productId !== it.productId))}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      <Card title="Summary">
        <div className="p-5 grid sm:grid-cols-4 gap-4 text-sm">
          <div><div className="text-slate-500">Subtotal</div><div className="text-lg font-semibold">{money(totals.subtotal)}</div></div>
          <div><div className="text-slate-500">Discount (৳)</div>
            <input type="number" min="0" className={inputCls + ' mt-1'} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></div>
          <div><div className="text-slate-500">Delivery</div><div className="text-lg font-semibold">{money(form.deliveryCharge)}</div></div>
          <div><div className="text-slate-500">Total</div><div className="text-2xl font-bold text-indigo-700">{money(totals.total)}</div></div>
        </div>
      </Card>

      <Modal open={custModal} onClose={() => setCustModal(false)} title="Quick add customer">
        <form onSubmit={addCustomer} className="space-y-4">
          <Field label="Name"><input name="name" className={inputCls} required /></Field>
          <Field label="Phone"><input name="phone" className={inputCls} required placeholder="01XXXXXXXXX" /></Field>
          <Field label="Address"><input name="address" className={inputCls} /></Field>
          <Field label="City"><input name="city" className={inputCls} defaultValue="Dhaka" /></Field>
          <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={() => setCustModal(false)}>Cancel</button><button className={btnPrimary}><Plus size={14} /> Add</button></div>
        </form>
      </Modal>
    </form>
  );
}
