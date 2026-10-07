import { useEffect, useState } from 'react';
import { Building2, Users, UserPlus, Wallet, Trash2, ShieldCheck } from 'lucide-react';
import client, { errMsg } from '../api/client';
import { Card, Spinner, Badge, Th, Td, Field, inputCls, btnPrimary, btnGhost, Modal } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { money, dateShort, titleize } from '../utils/format';

export default function Settings() {
  const { business, setBusiness, can } = useAuth();
  const [tab, setTab] = useState('business');
  const [users, setUsers] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [userModal, setUserModal] = useState(false);
  const [expModal, setExpModal] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadUsers = () => client.get('/users').then(({ data }) => setUsers(data.users)).catch(() => setUsers([]));
  const loadExpenses = () => client.get('/expenses').then(({ data }) => setExpenses(data.expenses)).catch(() => setExpenses([]));

  useEffect(() => {
    if (tab === 'users' && can('users')) loadUsers();
    if (tab === 'expenses' && can('finance')) loadExpenses();
  }, [tab]);

  const saveBusiness = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      const { data } = await client.put('/business', payload);
      setBusiness(data.business);
      setNotice('Business profile updated.');
    } catch (err) { alert(errMsg(err)); }
  };

  const addUser = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try { await client.post('/users', payload); setUserModal(false); loadUsers(); }
    catch (err) { alert(errMsg(err)); }
  };

  const toggleUser = async (u) => {
    try { await client.put(`/users/${u.id}`, { isActive: !u.isActive }); loadUsers(); }
    catch (err) { alert(errMsg(err)); }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    payload.amount = Number(payload.amount);
    try { await client.post('/expenses', payload); setExpModal(false); loadExpenses(); }
    catch (err) { alert(errMsg(err)); }
  };

  const removeExpense = async (id) => {
    if (!confirm('Delete this expense?')) return;
    try { await client.delete(`/expenses/${id}`); loadExpenses(); } catch (err) { alert(errMsg(err)); }
  };

  if (!business) return <Spinner />;

  const TABS = [['business', 'Business Profile', Building2], ['users', 'Team', Users], ...(can('finance') ? [['expenses', 'Expenses', Wallet]] : [])];

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">Business profile, team and expenses</p>
      </div>

      <div className="flex gap-2">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${tab === key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-2.5 text-sm">{notice}</div>}

      {tab === 'business' && (
        <Card title="Business profile">
          <form onSubmit={saveBusiness} className="p-5 grid sm:grid-cols-2 gap-4">
            <Field label="Business name"><input name="name" className={inputCls} defaultValue={business.name} required /></Field>
            <Field label="Currency">
              <select name="currency" className={inputCls} defaultValue={business.currency}>
                <option value="BDT">BDT ৳</option><option value="USD">USD $</option>
              </select>
            </Field>
            <Field label="Email"><input name="email" type="email" className={inputCls} defaultValue={business.email} /></Field>
            <Field label="Phone"><input name="phone" className={inputCls} defaultValue={business.phone} /></Field>
            <div className="sm:col-span-2"><Field label="Address"><input name="address" className={inputCls} defaultValue={business.address} /></Field></div>
            <div className="sm:col-span-2 flex justify-end"><button className={btnPrimary}>Save changes</button></div>
          </form>
        </Card>
      )}

      {tab === 'users' && can('users') && (
        <Card title="Team members" actions={<button className={btnGhost} onClick={() => setUserModal(true)}><UserPlus size={15} /> Add member</button>}>
          <table className="w-full">
            <thead className="bg-slate-50"><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th /></tr></thead>
            <tbody className="divide-y divide-slate-50">
              {(users || []).map((u) => (
                <tr key={u.id}>
                  <Td className="font-medium text-slate-700">{u.name}</Td>
                  <Td className="text-slate-500">{u.email}</Td>
                  <Td><Badge className="bg-indigo-50 text-indigo-700 capitalize">{u.role}</Badge></Td>
                  <Td><Badge className={u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{u.isActive ? 'Active' : 'Disabled'}</Badge></Td>
                  <Td className="text-right">
                    {u.role !== 'owner' && u.role !== 'admin' && (
                      <button onClick={() => toggleUser(u)} className="text-xs text-indigo-600 hover:underline">{u.isActive ? 'Disable' : 'Enable'}</button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck size={13} /> Roles: owner (full access) · manager (operations + analytics) · staff (orders only, no financials)
          </div>
        </Card>
      )}

      {tab === 'expenses' && can('finance') && (
        <Card title="Recorded expenses" actions={<button className={btnGhost} onClick={() => setExpModal(true)}><Wallet size={15} /> Add expense</button>}>
          <table className="w-full">
            <thead className="bg-slate-50"><tr><Th>Date</Th><Th>Category</Th><Th>Description</Th><Th className="text-right">Amount</Th><Th /></tr></thead>
            <tbody className="divide-y divide-slate-50">
              {(expenses || []).map((x) => (
                <tr key={x.id}>
                  <Td className="text-slate-500">{dateShort(x.expenseDate)}</Td>
                  <Td><Badge className="bg-slate-100 text-slate-600">{titleize(x.category)}</Badge></Td>
                  <Td className="text-slate-600">{x.description}</Td>
                  <Td className="text-right font-medium text-rose-600">{money(x.amount)}</Td>
                  <Td className="text-right"><button onClick={() => removeExpense(x.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button></Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">Expenses feed the profit formula (FR-22: “other recorded expenses”).</div>
        </Card>
      )}

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Add team member">
        <form onSubmit={addUser} className="space-y-4">
          <Field label="Name"><input name="name" className={inputCls} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><input name="email" type="email" className={inputCls} required /></Field>
            <Field label="Phone"><input name="phone" className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Temporary password"><input name="password" className={inputCls} required minLength={6} defaultValue="password123" /></Field>
            <Field label="Role">
              <select name="role" className={inputCls} defaultValue="staff">
                <option value="staff">Staff</option><option value="manager">Manager</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={() => setUserModal(false)}>Cancel</button><button className={btnPrimary}>Add member</button></div>
        </form>
      </Modal>

      <Modal open={expModal} onClose={() => setExpModal(false)} title="Add expense">
        <form onSubmit={addExpense} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select name="category" className={inputCls} defaultValue="marketing">
                {['marketing', 'rent', 'transport', 'packaging', 'salary', 'other'].map((c) => <option key={c} value={c}>{titleize(c)}</option>)}
              </select>
            </Field>
            <Field label="Amount (৳)"><input name="amount" type="number" min="0" step="0.01" className={inputCls} required /></Field>
          </div>
          <Field label="Description"><input name="description" className={inputCls} /></Field>
          <Field label="Date"><input name="expenseDate" type="date" className={inputCls} defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={() => setExpModal(false)}>Cancel</button><button className={btnPrimary}>Add</button></div>
        </form>
      </Modal>
    </div>
  );
}
