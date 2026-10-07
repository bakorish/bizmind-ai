import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrainCircuit, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { btnPrimary, inputCls, Field } from '../components/ui';
import { errMsg } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(form.email, form.password); navigate('/'); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  const quick = (email) => { setForm({ email, password: 'password123' }); };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-indigo-600 items-center justify-center mb-4 shadow-lg shadow-indigo-600/40">
            <BrainCircuit size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">BizMind AI</h1>
          <p className="text-slate-400 mt-2 text-sm">Business Intelligence & Decision Support for online sellers</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl p-8 space-y-4">
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <Field label="Email">
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-3 text-slate-400" />
              <input className={`${inputCls} pl-9`} type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@business.com" />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-3 text-slate-400" />
              <input className={`${inputCls} pl-9`} type="password" required value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
          </Field>
          <button className={`${btnPrimary} w-full py-2.5`} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <div className="text-center text-sm text-slate-500">
            New here? <Link to="/register" className="text-indigo-600 font-medium hover:underline">Create a business account</Link>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <div className="text-xs text-slate-400 mb-2 text-center">Demo accounts (password: password123)</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => quick('owner@bizmind.dev')} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 hover:border-indigo-400 hover:text-indigo-600">owner@bizmind.dev</button>
              <button type="button" onClick={() => quick('manager@bizmind.dev')} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 hover:border-indigo-400 hover:text-indigo-600">manager@bizmind.dev</button>
              <button type="button" onClick={() => quick('staff@bizmind.dev')} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 hover:border-indigo-400 hover:text-indigo-600">staff@bizmind.dev</button>
              <button type="button" onClick={() => quick('admin@bizmind.dev')} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 hover:border-indigo-400 hover:text-indigo-600">admin@bizmind.dev</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
