import { useEffect } from 'react';

export function Card({ children, className = '', title = null, actions = null }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          {typeof title === 'string' ? <h3 className="font-semibold text-slate-800">{title}</h3> : title}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function KpiCard({ label, value, sub = null, icon = null, tone = 'indigo', changePct = null }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600', emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600', violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
          {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
        </div>
        {icon && <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>{icon}</div>}
      </div>
      {changePct != null && (
        <div className={`mt-2 text-xs font-medium ${changePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {changePct >= 0 ? '▲' : '▼'} {Math.abs(Number(changePct)).toFixed(1)}% vs previous period
        </div>
      )}
    </div>
  );
}

export function Badge({ children, className = '' }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
      <div className="w-8 h-8 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin" style={{ borderWidth: 3 }} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = null, title, hint = null, action = null }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {icon && <div className="text-slate-300 mb-3">{icon}</div>}
      <div className="font-medium text-slate-600">{title}</div>
      {hint && <div className="text-sm text-slate-400 mt-1 max-w-sm">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint = null }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white';
export const btn = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition';
export const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50`;
export const btnGhost = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const btnDanger = `${btn} bg-rose-600 text-white hover:bg-rose-700`;

export function Th({ children, className = '' }) {
  return <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide ${className}`}>{children}</th>;
}
export function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}

export function RiskChip({ level, score }) {
  const cls = level === 'HIGH' ? 'bg-rose-100 text-rose-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  return <Badge className={cls}>{level === 'LOW' ? 'Low' : level === 'MEDIUM' ? 'Medium' : 'High'}{score != null ? ` · ${Math.round(score)}%` : ''}</Badge>;
}
