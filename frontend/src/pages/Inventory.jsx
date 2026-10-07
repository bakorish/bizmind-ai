import { useEffect, useState } from 'react';
import { Boxes, ArrowDownToLine, History, PlusCircle, MinusCircle, SlidersHorizontal } from 'lucide-react';
import client, { errMsg } from '../api/client';
import { Card, Modal, Spinner, Badge, Th, Td, Field, inputCls, btnPrimary, btnGhost } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { money, dateTime, titleize } from '../utils/format';

const TX_CHIP = {
  initial: 'bg-slate-100 text-slate-600', sold: 'bg-indigo-100 text-indigo-700',
  restock: 'bg-emerald-100 text-emerald-700', returned: 'bg-amber-100 text-amber-700',
  damaged: 'bg-rose-100 text-rose-700', adjustment: 'bg-sky-100 text-sky-700',
};

export default function Inventory() {
  const { can } = useAuth();
  const [inventory, setInventory] = useState(null);
  const [history, setHistory] = useState(null);
  const [tab, setTab] = useState('overview');
  const [adjust, setAdjust] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    client.get('/inventory').then(({ data }) => setInventory(data)).catch((e) => setError(errMsg(e)));
    client.get('/inventory/history').then(({ data }) => setHistory(data.transactions)).catch(() => setHistory([]));
  };
  useEffect(load, []);

  const submitAdjust = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await client.post('/inventory/adjust', {
        productId: adjust.id, type: fd.get('type'), quantity: Number(fd.get('quantity')), note: fd.get('note'),
      });
      setAdjust(null); load();
    } catch (err) { alert(errMsg(err)); }
  };

  if (error) return <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{error}</div>;
  if (!inventory || !history) return <Spinner />;

  const items = inventory.inventory;
  const stockValue = items.reduce((s, i) => s + i.stockValue, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-sm text-slate-500">{items.length} products · stock value {money(stockValue)} · {inventory.lowStockCount} low</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {[['overview', 'Overview', Boxes], ['history', 'Movement History', History]].map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm ${tab === key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><Th>Product</Th><Th>Current Stock</Th><Th>Status</Th><Th>Reorder @</Th><Th>Lead Time</Th><Th>Daily Velocity*</Th><Th>Stock Value</Th>{can('inventory') && <Th />}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((i) => (
                  <tr key={i.productId} className="hover:bg-slate-50/60">
                    <Td>
                      <div className="font-medium text-slate-700">{i.name}</div>
                      <div className="text-xs text-slate-400">{i.sku}</div>
                    </Td>
                    <Td className="font-semibold">{i.currentStock} <span className="text-xs text-slate-400">{i.unit}</span></Td>
                    <Td>
                      <Badge className={i.status === 'out_of_stock' ? 'bg-rose-100 text-rose-700' : i.status === 'low' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                        {i.status === 'out_of_stock' ? 'Out of stock' : i.status === 'low' ? 'Low' : 'OK'}
                      </Badge>
                    </Td>
                    <Td>{i.reorderLevel}</Td>
                    <Td>{i.leadTimeDays} days</Td>
                    <Td>—</Td>
                    <Td>{money(i.stockValue)}</Td>
                    {can('inventory') && (
                      <Td className="text-right">
                        <button className="text-xs text-indigo-600 hover:underline" onClick={() => setAdjust({ ...i })}>Adjust</button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
            * Daily velocity and smart reorder quantities are on the <a href="/ai" className="text-indigo-500 hover:underline">AI Insights → Inventory</a> tab.
          </div>
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><Th>When</Th><Th>Product</Th><Th>Type</Th><Th>Change</Th><Th>Balance</Th><Th>Reference</Th><Th>Note</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <Td className="whitespace-nowrap text-slate-500">{dateTime(t.createdAt)}</Td>
                    <Td className="font-medium text-slate-700">{t.Product?.name || `#${t.productId}`}</Td>
                    <Td><Badge className={TX_CHIP[t.type] || TX_CHIP.initial}>{titleize(t.type)}</Badge></Td>
                    <Td className={t.quantity >= 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                      {t.quantity >= 0 ? `+${t.quantity}` : t.quantity}
                    </Td>
                    <Td>{t.balanceAfter}</Td>
                    <Td className="text-slate-500">{t.referenceType}{t.referenceId ? ` #${t.referenceId}` : ''}</Td>
                    <Td className="text-slate-400 max-w-[200px] truncate">{t.note || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!adjust} onClose={() => setAdjust(null)} title={`Adjust stock — ${adjust?.name || ''}`}>
        {adjust && (
          <form onSubmit={submitAdjust} className="space-y-4">
            <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-600">
              Current stock: <b>{adjust.currentStock}</b> {adjust.unit} · reorder level {adjust.reorderLevel}
            </div>
            <Field label="Movement type">
              <select name="type" className={inputCls} required defaultValue="restock">
                <option value="restock">Restock (+)</option>
                <option value="damaged">Damaged / lost (−)</option>
                <option value="adjustment">Adjustment (signed ±)</option>
              </select>
            </Field>
            <Field label="Quantity" hint="For adjustment: positive adds, negative removes">
              <input name="quantity" type="number" className={inputCls} required defaultValue={1} />
            </Field>
            <Field label="Note"><input name="note" className={inputCls} placeholder="e.g. supplier delivery #104" /></Field>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setAdjust(null)}>Cancel</button>
              <button className={btnPrimary}>Apply</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
