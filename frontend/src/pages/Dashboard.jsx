import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { ShoppingBag, Truck, XCircle, RotateCcw, Wallet, TrendingUp, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import client, { errMsg } from '../api/client';
import { Card, KpiCard, Spinner, Badge, Th, Td } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { money, dateShort, STATUS_META } from '../utils/format';

export default function Dashboard() {
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [insight, setInsight] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    client.get('/analytics/dashboard').then(({ data }) => setData(data.dashboard)).catch((e) => setError(errMsg(e)));
    if (can('ai')) client.get('/ai/insights').then(({ data }) => setInsight(data.insights)).catch(() => {});
  }, []);

  if (error) return <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{error}</div>;
  if (!data) return <Spinner label="Loading dashboard…" />;

  const { today, week, month, profit, series30, topProducts, lowStock } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Business health at a glance</p>
        </div>
        <Link to="/orders/new" className="inline-flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700">
          <ShoppingBag size={15} /> New Order
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Today's Sales" value={money(today.revenue)} icon={<Wallet size={18} />}
          sub={`${today.counts.delivered} delivered · ${today.counts.total} orders`} />
        <KpiCard label="This Week" value={money(week.revenue)} tone="sky" icon={<TrendingUp size={18} />}
          sub={`${week.counts.total} orders`} changePct={week.revenueChangePct} />
        <KpiCard label="This Month" value={money(month.revenue)} tone="violet" icon={<TrendingUp size={18} />}
          sub={`AOV ${money(month.aov)}`} changePct={month.revenueChangePct} />
        {can('finance') ? (
          <KpiCard label="Profit (30d)" value={money(profit.profit)} tone="emerald" icon={<Wallet size={18} />}
            sub={`Margin ${profit.margin?.toFixed(1)}%`} changePct={profit.profitChangePct} />
        ) : (
          <KpiCard label="Delivered (30d)" value={month.counts.delivered} tone="emerald" icon={<Truck size={18} />}
            sub={`${month.counts.cancelled} cancelled`} />
        )}
      </div>

      {/* AI insight banner */}
      {insight?.insights?.length > 0 && (
        <Link to="/ai" className="block bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-5 text-white shadow-sm hover:opacity-95 transition">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">{insight.insights[0].title}</div>
              <div className="text-sm text-indigo-100 mt-1 line-clamp-2">{insight.insights[0].detail}</div>
            </div>
            <ArrowRight size={18} className="ml-auto mt-1 shrink-0" />
          </div>
        </Link>
      )}

      {/* Order status strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Orders', value: month.counts.total, cls: 'text-slate-800' },
          { label: 'Delivered', value: month.counts.delivered, cls: 'text-emerald-600' },
          { label: 'In Pipeline', value: month.counts.pending + month.counts.confirmed + month.counts.processing + month.counts.shipped, cls: 'text-indigo-600' },
          { label: 'Cancelled', value: month.counts.cancelled, cls: 'text-rose-600' },
          { label: 'Returned', value: month.counts.returned, cls: 'text-orange-600' },
          { label: 'AOV', value: money(month.aov), cls: 'text-slate-800' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <div className={`text-xl font-bold ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sales chart */}
        <Card className="xl:col-span-2" title="Sales — last 30 days">
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series30}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={dateShort} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={50} />
                <Tooltip labelFormatter={(d) => dateShort(d)} formatter={(v, k) => [k === 'revenue' ? money(v) : v, k === 'revenue' ? 'Revenue' : 'Units']}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Low stock */}
        <Card title={<span className="flex items-center gap-2 font-semibold text-slate-800"><AlertTriangle size={16} className="text-amber-500" /> Low Stock Alerts</span>}
          actions={<Link to="/inventory" className="text-xs text-indigo-600 hover:underline">View all</Link>}>
          <div className="divide-y divide-slate-50">
            {lowStock.length === 0 && <div className="p-6 text-center text-sm text-slate-400">All stock levels healthy 🎉</div>}
            {lowStock.map((p) => (
              <div key={p.productId} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-700">{p.name}</div>
                  <div className="text-xs text-slate-400">reorder at {p.reorderLevel}</div>
                </div>
                <Badge className={p.currentStock === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}>
                  {p.currentStock} {p.unit} left
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top products */}
        <Card className="xl:col-span-2" title="Top Products (30 days)">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50"><tr><Th>Product</Th><Th>Units</Th><Th>Revenue</Th>{can('finance') && <Th>Profit</Th>}<Th>Return %</Th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {topProducts.map((p) => (
                  <tr key={p.productId} className="hover:bg-slate-50/60">
                    <Td className="font-medium text-slate-700">{p.name}</Td>
                    <Td>{p.unitsSold}</Td>
                    <Td>{money(p.revenue)}</Td>
                    {can('finance') && <Td className="text-emerald-700">{money(p.profit)}</Td>}
                    <Td>
                      <Badge className={p.returnRate > 15 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}>{p.returnRate}%</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Status legend + quick links */}
        <Card title="Order Pipeline">
          <div className="p-5 space-y-3">
            {['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery'].map((s) => (
              <div key={s} className="flex items-center justify-between">
                <Badge className={STATUS_META[s].chip}>{STATUS_META[s].label}</Badge>
                <span className="text-sm font-semibold text-slate-700">{month.counts[s] ?? 0}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              {[
                { to: '/orders?status=cancelled', icon: XCircle, label: 'Cancelled orders', cls: 'text-rose-500' },
                { to: '/orders?status=returned', icon: RotateCcw, label: 'Returned orders', cls: 'text-orange-500' },
                { to: '/ai', icon: Sparkles, label: 'AI insights & forecast', cls: 'text-indigo-500' },
              ].map((l) => (
                <Link key={l.to} to={l.to} className="flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600">
                  <l.icon size={15} className={l.cls} /> {l.label}
                  <ArrowRight size={13} className="ml-auto text-slate-300" />
                </Link>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
