import { useEffect, useState } from 'react';
import { Users, UserPlus, Search, Phone, MapPin } from 'lucide-react';
import client, { errMsg } from '../api/client';
import { Card, Modal, Spinner, Badge, Th, Td, Field, inputCls, btnPrimary, btnGhost, EmptyState } from '../components/ui';
import { money, dateShort, STATUS_META } from '../utils/format';

export default function Customers() {
  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // create | {customer}
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  const load = () => client.get('/customers', { params: search ? { search } : {} })
    .then(({ data }) => setCustomers(data.customers))
    .catch((e) => setError(errMsg(e)));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search]);

  const save = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (modal.id) await client.put(`/customers/${modal.id}`, payload);
      else await client.post('/customers', payload);
      setModal(null); load();
    } catch (err) { alert(errMsg(err)); }
  };

  const openDetail = async (c) => {
    const { data } = await client.get(`/customers/${c.id}`);
    setDetail(data);
  };

  if (error) return <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{error}</div>;
  if (!customers) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
          <p className="text-sm text-slate-500">{customers.length} customers</p>
        </div>
        <button className={btnPrimary} onClick={() => setModal({})}><UserPlus size={15} /> Add Customer</button>
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input className={`${inputCls} pl-9`} placeholder="Search name / phone / email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {customers.length === 0 ? (
          <EmptyState icon={<Users size={36} />} title="No customers found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><Th>Customer</Th><Th>Location</Th><Th>Orders</Th><Th>Completed</Th><Th>Cancelled</Th><Th>Returned</Th><Th>Total Spend</Th><Th>Risk</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => openDetail(c)}>
                    <Td>
                      <div className="font-medium text-slate-700">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.phone}</div>
                    </Td>
                    <Td className="text-slate-500">{c.city}</Td>
                    <Td>{c.totalOrders}</Td>
                    <Td className="text-emerald-600">{c.completedOrders}</Td>
                    <Td className={c.cancelledOrders > 0 ? 'text-rose-500' : 'text-slate-400'}>{c.cancelledOrders}</Td>
                    <Td className={c.returnedOrders > 0 ? 'text-orange-500' : 'text-slate-400'}>{c.returnedOrders}</Td>
                    <Td className="font-medium">{money(c.totalSpending)}</Td>
                    <Td>
                      <Badge className={c.cancellationRate > 0.3 ? 'bg-rose-100 text-rose-700' : c.cancellationRate > 0.15 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                        {c.cancellationRate > 0.3 ? 'High risk' : c.cancellationRate > 0.15 ? 'Watch' : 'Healthy'}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* create/edit */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit Customer' : 'Add Customer'}>
        {modal && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Name"><input name="name" className={inputCls} required defaultValue={modal.name} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><input name="phone" className={inputCls} required defaultValue={modal.phone} placeholder="01XXXXXXXXX" /></Field>
              <Field label="Email"><input name="email" type="email" className={inputCls} defaultValue={modal.email} /></Field>
            </div>
            <Field label="Address"><input name="address" className={inputCls} defaultValue={modal.address} /></Field>
            <Field label="City"><input name="city" className={inputCls} defaultValue={modal.city} /></Field>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setModal(null)}>Cancel</button>
              <button className={btnPrimary}>{modal.id ? 'Save' : 'Add'}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* detail drawer */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.customer?.name} wide>
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                ['Total Orders', detail.customer.totalOrders],
                ['Completed', detail.customer.completedOrders],
                ['Cancelled', detail.customer.cancelledOrders],
                ['Returned', detail.customer.returnedOrders],
                ['Total Spend', money(detail.customer.totalSpending)],
              ].map(([l, v]) => (
                <div key={l} className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-slate-800">{v}</div>
                  <div className="text-xs text-slate-500">{l}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Phone size={13} /> {detail.customer.phone}</span>
              <span className="flex items-center gap-1.5"><MapPin size={13} /> {detail.customer.address}</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-600 mb-2">Order history</div>
              <div className="max-h-72 overflow-y-auto border border-slate-100 rounded-lg">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0"><tr><Th>Order</Th><Th>Date</Th><Th>Status</Th><Th className="text-right">Total</Th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {detail.orders.map((o) => (
                      <tr key={o.id}>
                        <Td className="font-medium text-indigo-600">{o.orderNo}</Td>
                        <Td>{dateShort(o.orderDate)}</Td>
                        <Td><Badge className={STATUS_META[o.status].chip}>{STATUS_META[o.status].label}</Badge></Td>
                        <Td className="text-right">{money(o.total)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
