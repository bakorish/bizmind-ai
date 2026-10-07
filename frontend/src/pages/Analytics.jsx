import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import client, { errMsg } from '../api/client';
import { Card, KpiCard, Spinner, Badge, Th, Td } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { money, dateShort } from '../utils/format';

const PERIODS = [
  ['today', 'Today'], ['week', '7 days'], ['month', '30 days'], ['quarter', '90 days'], ['year', '1 year'], ['all', 'All'],
];
const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6', '#84cc16'];

export default function Analytics() {
  const { can } = useAuth();
  const [period, setPeriod] = useState('month');
  const [summary, setSummary] = useState(null);
  const [profit, setProfit] = useState(null);
  const [perf, setPerf] = useState(null);
  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [gran, setGran] = useState('daily');
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    client.get('/analytics/sales', { params: { period } }).then(({ data }) => setSummary(data.summary)).catch((e) => setError(errMsg(e)));
    if (can('finance')) client.get('/analytics/profit', { params: { period } }).then(({ data }) => setProfit(data.profit)).catch(() => setProfit(null));
    client.get('/analytics/products', { params: { period } }).then(({ data }) => setPerf(data.products)).catch(() => {});
    client.get('/analytics/series', { params: { granularity: 'daily', days: 60 } }).then(({ data }) => setDaily(data.series)).catch(() => {});
    client.get('/analytics/series', { params: { granularity: 'monthly', months: 12 } }).then(({ data }) => setMonthly(data.series)).catch(() => {});
  }, [period]);

  if (error) return <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{error}</div>;
  if (!summary) return <Spinner label="Crunching numbers…" />;

  const c = summary.counts;
  const costData = profit ? [
    { name: 'Product cost', value: profit.productCost },
    { name: 'Delivery', value: profit.deliveryCost },
    { name: 'Returns', value: profit.returnCost },
    { name: 'Expenses', value: profit.otherExpenses },
    { name: 'Profit', value: profit.profit },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
          <p className="text-sm text-slate-500">Sales, revenue and product performance</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {PERIODS.map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-md text-sm ${period === key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Revenue" value={money(summary.revenue)} changePct={summary.revenueChangePct} sub={`${c.delivered} delivered orders`} />
        <KpiCard label="Orders" value={c.total} tone="sky" sub={`${c.cancelled} cancelled · ${c.returned} returned`} />
        <KpiCard label="Avg Order Value" value={money(summary.aov)} tone="violet" />
        <KpiCard label="Cancel + Return Rate" value={`${(((c.cancelled + c.returned) / Math.max(c.total, 1)) * 100).toFixed(1)}%`} tone="rose"
          sub={`${c.cancelled + c.returned} of ${c.total} orders`} />
      </div>

      {/* Sales trend */}
      <Card title={gran === 'daily' ? 'Sales trend — daily (60 days)' : 'Sales trend — monthly (12 months)'}
        actions={
          <div className="flex rounded-md border border-slate-200 p-0.5 text-xs">
            <button onClick={() => setGran('daily')} className={`px-2.5 py-1 rounded ${gran === 'daily' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Daily</button>
            <button onClick={() => setGran('monthly')} className={`px-2.5 py-1 rounded ${gran === 'monthly' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Monthly</button>
          </div>
        }>
        <div className="p-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={gran === 'daily' ? daily : monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey={gran === 'daily' ? 'date' : 'month'} tickFormatter={(v) => (gran === 'daily' ? dateShort(v) : v)} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={gran === 'daily' ? 6 : 0} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={55} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v, k) => [k === 'revenue' ? money(v) : v, k === 'revenue' ? 'Revenue' : 'Units']} />
              <Legend formatter={(v) => (v === 'revenue' ? 'Revenue' : 'Units')} wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="r" dataKey="units" fill="#c7d2fe" radius={[4, 4, 0, 0]} barSize={gran === 'daily' ? 8 : 22} />
              <Line yAxisId="l" type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Product performance */}
        <Card className="xl:col-span-2" title="Product Performance">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr><Th>#</Th><Th>Product</Th><Th>Units</Th><Th>Revenue</Th>{can('finance') && <Th>Profit</Th>}<Th>Return %</Th><Th>Cancel %</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(perf || []).map((p, i) => (
                  <tr key={p.productId} className="hover:bg-slate-50/60">
                    <Td className="text-slate-400">{i + 1}</Td>
                    <Td className="font-medium text-slate-700">{p.name}</Td>
                    <Td>{p.unitsSold}</Td>
                    <Td>{money(p.revenue)}</Td>
                    {can('finance') && <Td className="text-emerald-700">{money(p.profit)}</Td>}
                    <Td><Badge className={p.returnRate > 15 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}>{p.returnRate}%</Badge></Td>
                    <Td><Badge className={p.cancellationRate > 20 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}>{p.cancellationRate}%</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Profit breakdown (owner only — BR-04) */}
        {can('finance') && profit && (
          <Card title="Where the money goes">
            <div className="p-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={costData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                    {costData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-5 pb-5 space-y-1.5 text-sm border-t border-slate-100 pt-4">
              <div className="flex justify-between"><span className="text-slate-500">Revenue (net)</span><span className="font-medium">{money(profit.revenue)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Product cost</span><span className="text-rose-600">−{money(profit.productCost)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Delivery cost</span><span className="text-rose-600">−{money(profit.deliveryCost)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Return cost</span><span className="text-rose-600">−{money(profit.returnCost)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Other expenses</span><span className="text-rose-600">−{money(profit.otherExpenses)}</span></div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-100">
                <span>Profit</span>
                <span className={profit.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{money(profit.profit)} <span className="text-xs text-slate-400">({profit.margin}%)</span></span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
