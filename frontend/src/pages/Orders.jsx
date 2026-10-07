import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Search, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import client, { errMsg } from '../api/client';
import { Card, Spinner, Badge, Th, Td, inputCls, btnPrimary, EmptyState, RiskChip } from '../components/ui';
import { money, dateShort, STATUS_META, PAY_METHOD_LABEL } from '../utils/format';

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState(params.get('q') || '');
  const status = params.get('status') || '';

  const page = Number(params.get('page') || 1);
  const load = () => {
    const clean = Object.fromEntries([...params.entries()].filter(([, v]) => v !== '' && v != null));
    client.get('/orders', { params: { ...clean, limit: 15 } })
      .then(({ data }) => setData(data))
      .catch((e) => setError(errMsg(e)));
  };
  useEffect(load, [params]);

  // debounce search box -> query param
  useEffect(() => { const t = setTimeout(() => setParams((p) => { p.set('q', q); p.delete('page'); return p; }, { replace: true }), 300); return () => clearTimeout(t); }, [q]);

  if (error) return <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{error}</div>;
  if (!data) return <Spinner />;

  const pages = Math.max(1, Math.ceil(data.total / 15));
  const goPage = (p) => setParams((prev) => { prev.set('page', p); return prev; }, { replace: true });
  const setStatus = (s) => setParams((prev) => { s ? prev.set('status', s) : prev.delete('status'); prev.delete('page'); return prev; }, { replace: true });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
          <p className="text-sm text-slate-500">{data.total} orders</p>
        </div>
        <Link to="/orders/new" className={btnPrimary}><Plus size={15} /> New Order</Link>
      </div>

      <Card>
        <div className="p-4 flex flex-wrap gap-3 items-center border-b border-slate-100">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input className={`${inputCls} pl-9`} placeholder="Search order no, customer, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setStatus('')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${!status ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>All</button>
            {Object.entries(STATUS_META).map(([key, m]) => (
              <button key={key} onClick={() => setStatus(key)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition ${status === key ? 'bg-slate-800 text-white' : m.chip + ' hover:opacity-80'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {data.orders.length === 0 ? (
          <EmptyState icon={<ShoppingCart size={36} />} title="No orders match" hint="Try clearing filters or creating a new order." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr><Th>Order</Th><Th>Date</Th><Th>Customer</Th><Th>Items</Th><Th>Payment</Th><Th>Risk</Th><Th className="text-right">Total</Th><Th>Status</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => location.href = `/orders/${o.id}`}>
                      <Td className="font-medium text-indigo-600">{o.orderNo}</Td>
                      <Td className="whitespace-nowrap text-slate-500">{dateShort(o.orderDate)}</Td>
                      <Td>
                        <div className="font-medium text-slate-700">{o.Customer?.name}</div>
                        <div className="text-xs text-slate-400">{o.Customer?.phone}</div>
                      </Td>
                      <Td className="text-slate-500">{o.items?.length} item{o.items?.length > 1 ? 's' : ''}</Td>
                      <Td>
                        <Badge className={o.paymentMethod === 'cod' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-sky-50 text-sky-700 border border-sky-200'}>
                          {PAY_METHOD_LABEL[o.paymentMethod] || o.paymentMethod}
                        </Badge>
                      </Td>
                      <Td>{o.riskLevel ? <RiskChip level={o.riskLevel} score={o.riskScore} /> : <span className="text-slate-300 text-xs">—</span>}</Td>
                      <Td className="text-right font-semibold">{money(o.total)}</Td>
                      <Td><Badge className={STATUS_META[o.status].chip}>{STATUS_META[o.status].label}</Badge></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">Page {page} of {pages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => goPage(page - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft size={15} /></button>
                <button disabled={page >= pages} onClick={() => goPage(page + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronRight size={15} /></button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
