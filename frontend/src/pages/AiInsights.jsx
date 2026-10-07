import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Sparkles, TrendingUp, TrendingDown, PackageSearch, ShieldAlert, Boxes,
  Lightbulb, RefreshCw, Info, ArrowRight, ShoppingCart,
} from 'lucide-react';
import client, { errMsg } from '../api/client';
import { Card, KpiCard, Spinner, Badge, Th, Td, RiskChip } from '../components/ui';
import { money, dateShort } from '../utils/format';

const TABS = [
  ['insights', 'Insights', Lightbulb],
  ['forecast', 'Sales Forecast', TrendingUp],
  ['demand', 'Demand', PackageSearch],
  ['risk', 'Order Risk', ShieldAlert],
  ['inventory', 'Inventory Recs', Boxes],
];

function AiNote({ model, note }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 px-1">
      {model && <span>Model: {model}</span>}
      <span className="flex items-center gap-1"><Info size={11} /> {note || 'Estimates based on historical data — not guarantees.'}</span>
    </div>
  );
}

export default function AiInsights() {
  const [tab, setTab] = useState('insights');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [horizon, setHorizon] = useState(30);
  const [demand, setDemand] = useState(null);
  const [risk, setRisk] = useState(null);
  const [inv, setInv] = useState(null);

  const loadTab = async (t) => {
    setLoading(true); setError(null);
    try {
      if (t === 'insights') setInsights((await client.get('/ai/insights')).data.insights);
      if (t === 'forecast') setForecast((await client.get('/ai/sales-forecast', { params: { days: horizon } })).data.forecast);
      if (t === 'demand') setDemand((await client.get('/ai/demand-prediction')).data.prediction);
      if (t === 'risk') setRisk((await client.get('/ai/risk-prediction')).data.risk);
      if (t === 'inventory') setInv((await client.get('/ai/recommendations')).data.recommendations);
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadTab(tab); }, [tab]);
  useEffect(() => { if (tab === 'forecast') loadTab('forecast'); }, [horizon]);

  const sev = { warning: 'border-l-amber-400 bg-amber-50/40', positive: 'border-l-emerald-400 bg-emerald-50/40', info: 'border-l-slate-300 bg-slate-50/40' };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Sparkles className="text-indigo-600" size={24} /> AI Insights</h1>
          <p className="text-sm text-slate-500">What happened, why, what's next — and what to do about it</p>
        </div>
        <button onClick={() => loadTab(tab)} disabled={loading} className="inline-flex items-center gap-1.5 text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{error}</div>}
      {loading && <Spinner label="Model training on your business data…" />}

      {!loading && tab === 'insights' && insights && (
        <div className="space-y-4">
          {!insights.sufficientData && <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl p-4 text-sm">{insights.reason || 'Not enough data yet.'}</div>}
          <div className="grid grid-cols-1 gap-4">
            {insights.insights?.map((ins, i) => (
              <div key={i} className={`border-l-4 rounded-r-xl p-5 bg-white shadow-sm border border-slate-200 ${sev[ins.severity] || sev.info}`}>
                <div className="font-semibold text-slate-800 flex items-center gap-2">
                  {ins.severity === 'warning' && <ShieldAlert size={16} className="text-amber-500" />}
                  {ins.severity === 'positive' && <TrendingUp size={16} className="text-emerald-500" />}
                  {ins.title}
                </div>
                <div className="text-sm text-slate-600 mt-1.5 leading-relaxed">{ins.detail}</div>
                <Badge className="bg-white/70 text-slate-500 mt-2.5">{ins.category}</Badge>
              </div>
            ))}
          </div>
          <Link to="/assistant" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
            Ask the AI Assistant about any of this <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {!loading && tab === 'forecast' && forecast && (
        !forecast.sufficientData ? (
          <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl p-4 text-sm">{forecast.reason}</div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              {[7, 30, 90].map((d) => (
                <button key={d} onClick={() => setHorizon(d)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm ${horizon === d ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Next {d} days</button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard label={`Predicted units (${horizon}d)`} value={Math.round(forecast.predictedUnits)} icon={<TrendingUp size={18} />} />
              <KpiCard label="Per day" value={forecast.predictedPerDay} tone="sky" />
              <KpiCard label="Range (80% conf.)" value={`${Math.round(forecast.lower)} – ${Math.round(forecast.upper)}`} tone="violet" />
              <KpiCard label="Trend" value={`${forecast.trendPct > 0 ? '+' : ''}${forecast.trendPct}%`} tone={forecast.trendPct >= 0 ? 'emerald' : 'rose'}
                icon={forecast.trendPct >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} />
            </div>
            <Card title="Forecast curve">
              <div className="p-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecast.series}>
                    <defs>
                      <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={dateShort} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={Math.floor(forecast.series.length / 8)} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={38} />
                    <Tooltip labelFormatter={dateShort} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                    <Area type="monotone" dataKey="predictedUnits" stroke="#8b5cf6" strokeWidth={2} fill="url(#fc)" name="Predicted units/day" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <AiNote model={forecast.model} note={`Trained on ${forecast.trainingRows} days of sales.`} />
          </div>
        )
      )}

      {!loading && tab === 'demand' && demand && (
        !demand.sufficientData ? (
          <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl p-4 text-sm">{demand.reason}</div>
        ) : (
          <div className="space-y-4">
            <Card title="Predicted 30-day demand by product">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50"><tr><Th>Product</Th><Th>Predicted (30d)</Th><Th>Daily rate</Th><Th>Trend</Th><Th>Share</Th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {demand.predictions.map((p) => {
                      const max = demand.predictions[0].predictedUnits || 1;
                      return (
                        <tr key={p.productId} className="hover:bg-slate-50/60">
                          <Td className="font-medium text-slate-700">{p.productName}</Td>
                          <Td className="font-semibold">{Math.round(p.predictedUnits)}</Td>
                          <Td>{p.dailyRate}/day</Td>
                          <Td>
                            <Badge className={p.trend === 'increasing' ? 'bg-emerald-100 text-emerald-700' : p.trend === 'decreasing' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}>
                              {p.trend === 'increasing' ? '▲' : p.trend === 'decreasing' ? '▼' : '—'} {p.trend}
                            </Badge>
                          </Td>
                          <Td>
                            <div className="w-36 bg-slate-100 rounded-full h-2">
                              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(p.predictedUnits / max) * 100}%` }} />
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            <AiNote model={demand.model} />
          </div>
        )
      )}

      {!loading && tab === 'risk' && risk && (
        !risk.sufficientData ? (
          <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl p-4 text-sm">{risk.reason}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard label="Open orders scored" value={risk.orders.length} icon={<ShoppingCart size={18} />} />
              <KpiCard label="High risk" value={risk.highRisk.length} tone="rose" icon={<ShieldAlert size={18} />} />
              <KpiCard label="Training orders" value={risk.trainingStats?.orders} tone="sky" sub="historical outcomes learned" />
              <KpiCard label="Historic cancel rate" value={`${(risk.trainingStats?.cancelRate * 100).toFixed(1)}%`} tone="amber" />
            </div>
            <Card title="Open orders by risk">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50"><tr><Th>Order</Th><Th>Customer</Th><Th>Status</Th><Th>Total</Th><Th>Payment</Th><Th>Cancel risk</Th><Th>Return risk</Th><Th>Level</Th><Th /></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {risk.orders.map((r) => (
                      <tr key={r.orderId} className="hover:bg-slate-50/60">
                        <Td className="font-medium text-indigo-600"><Link to={`/orders/${r.orderId}`}>{r.orderNo}</Link></Td>
                        <Td>{r.customer}</Td>
                        <Td className="text-slate-500 capitalize">{r.status.replace(/_/g, ' ')}</Td>
                        <Td>{money(r.total)}</Td>
                        <Td className="text-slate-500">{r.paymentMethod}</Td>
                        <Td><div className="flex items-center gap-2"><div className="w-20 bg-slate-100 rounded-full h-1.5"><div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${r.cancellationRiskPct}%` }} /></div><span className="text-xs">{r.cancellationRiskPct}%</span></div></Td>
                        <Td><div className="flex items-center gap-2"><div className="w-20 bg-slate-100 rounded-full h-1.5"><div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${r.returnRiskPct}%` }} /></div><span className="text-xs">{r.returnRiskPct}%</span></div></Td>
                        <Td><RiskChip level={r.riskLevel} /></Td>
                        <Td>{r.riskLevel !== 'LOW' && <Link to={`/orders/${r.orderId}`} className="text-xs text-indigo-600 hover:underline">Review →</Link>}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <AiNote model={risk.model} note="High-risk orders are usually COD, high-value, or from customers with prior cancellations." />
          </div>
        )
      )}

      {!loading && tab === 'inventory' && inv && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard label="Reorder now" value={inv.summary?.reorder ?? '—'} tone="rose" icon={<Boxes size={18} />} />
            <KpiCard label="Monitor" value={inv.summary?.monitor ?? '—'} tone="sky" />
            <KpiCard label="Overstock" value={inv.summary?.overstock ?? '—'} tone="amber" />
            <KpiCard label="Policy" value={<span className="text-sm">{inv.policy}</span>} tone="violet" />
          </div>
          <Card title="Smart stock recommendations">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr><Th>Product</Th><Th>Stock</Th><Th>Velocity/day</Th><Th>Pred. demand (30d)</Th><Th>Days of cover</Th><Th>Recommended buy</Th><Th>Action</Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {inv.recommendations.map((r) => (
                    <tr key={r.productId} className={`hover:bg-slate-50/60 ${r.action === 'reorder' ? 'bg-rose-50/30' : ''}`}>
                      <Td className="font-medium text-slate-700">{r.productName}</Td>
                      <Td>{r.currentStock}</Td>
                      <Td>{r.dailyVelocity}</Td>
                      <Td>{Math.round(r.predictedDemand30d)}</Td>
                      <Td>{r.daysOfCover ?? '∞'}</Td>
                      <Td>{r.action === 'reorder' ? <span className="font-bold text-indigo-700">{r.recommendedPurchase} units</span> : '—'}</Td>
                      <Td>
                        <Badge className={r.action === 'reorder' ? 'bg-rose-100 text-rose-700' : r.action === 'overstock' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                          {r.action}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <AiNote note={inv.disclaimer} />
        </div>
      )}
    </div>
  );
}
