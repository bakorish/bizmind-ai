import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrainCircuit } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { btnPrimary, inputCls, Field } from '../components/ui';
import { errMsg } from '../api/client';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', businessName: '', currency: 'BDT' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await register(form); navigate('/'); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-indigo-600 items-center justify-center mb-4 shadow-lg shadow-indigo-600/40">
            <BrainCircuit size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Create your business</h1>
          <p className="text-slate-400 mt-2 text-sm">Start managing orders, inventory and AI insights</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl p-8 space-y-4">
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <Field label="Your name"><input className={inputCls} required value={form.name} onChange={set('name')} /></Field>
          <Field label="Business name"><input className={inputCls} required value={form.businessName} onChange={set('businessName')} placeholder="e.g. StyleBazaar BD" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><input className={inputCls} type="email" required value={form.email} onChange={set('email')} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Password" hint="min 6 characters"><input className={inputCls} type="password" required minLength={6} value={form.password} onChange={set('password')} /></Field>
            <Field label="Currency">
              <select className={inputCls} value={form.currency} onChange={set('currency')}>
                <option value="BDT">BDT ৳</option><option value="USD">USD $</option>
              </select>
            </Field>
          </div>
          <button className={`${btnPrimary} w-full py-2.5`} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          <div className="text-center text-sm text-slate-500">
            Already registered? <Link to="/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
