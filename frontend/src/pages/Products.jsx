import { useEffect, useState } from 'react';
import { Package, Plus, Pencil, Trash2, Search, Tag } from 'lucide-react';
import client, { errMsg } from '../api/client';
import { Card, Modal, Spinner, Badge, Th, Td, Field, inputCls, btnPrimary, btnGhost, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { money } from '../utils/format';

const EMPTY = { name: '', sku: '', categoryId: '', sellingPrice: '', costPrice: '', initialStock: 0, reorderLevel: 10, leadTimeDays: 7, unit: 'pcs', description: '' };

export default function Products() {
  const { can } = useAuth();
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // {mode, product?}
  const [catModal, setCatModal] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = () => {
    client.get('/products', { params: search ? { search } : {} })
      .then(({ data }) => setProducts(data.products))
      .catch((e) => setError(errMsg(e)));
    client.get('/categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
  };
  useEffect(load, [search]);

  const save = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.sellingPrice = Number(payload.sellingPrice); payload.costPrice = Number(payload.costPrice);
    payload.initialStock = Number(payload.initialStock || 0); payload.reorderLevel = Number(payload.reorderLevel);
    payload.leadTimeDays = Number(payload.leadTimeDays || 7);
    if (payload.categoryId === '') delete payload.categoryId;
    try {
      if (modal.mode === 'edit') await client.put(`/products/${modal.product.id}`, payload);
      else await client.post('/products', payload);
      setModal(null); load();
    } catch (err) { alert(errMsg(err)); }
  };

  const deactivate = async (p) => {
    if (!confirm(`Deactivate "${p.name}"? Order history is preserved.`)) return;
    try { await client.delete(`/products/${p.id}`); load(); setNotice(`"${p.name}" deactivated.`); }
    catch (err) { alert(errMsg(err)); }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try { await client.post('/categories', { name: fd.get('name'), description: fd.get('description') }); setCatModal(false); load(); }
    catch (err) { alert(errMsg(err)); }
  };

  if (error) return <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{error}</div>;
  if (!products) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-sm text-slate-500">{products.length} active products</p>
        </div>
        {can('products') && (
          <div className="flex gap-2">
            <button className={btnGhost} onClick={() => setCatModal(true)}><Tag size={15} /> Category</button>
            <button className={btnPrimary} onClick={() => setModal({ mode: 'create' })}><Plus size={15} /> Add Product</button>
          </div>
        )}
      </div>

      {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-2.5 text-sm">{notice}</div>}

      <Card>
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input className={`${inputCls} pl-9`} placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {products.length === 0 ? (
          <EmptyState icon={<Package size={36} />} title="No products yet" hint="Add your first product to start taking orders." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><Th>Product</Th><Th>Category</Th><Th>Cost</Th><Th>Price</Th><Th>Margin</Th><Th>Stock</Th><Th>Reorder @</Th><Th /></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <Td>
                      <div className="font-medium text-slate-700">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.sku}</div>
                    </Td>
                    <Td><Badge className="bg-slate-100 text-slate-600">{p.category || '—'}</Badge></Td>
                    <Td>{money(p.costPrice)}</Td>
                    <Td className="font-medium">{money(p.sellingPrice)}</Td>
                    <Td><span className={p.margin >= 50 ? 'text-emerald-600' : 'text-slate-600'}>{p.margin}%</span></Td>
                    <Td>
                      <Badge className={p.currentStock === 0 ? 'bg-rose-100 text-rose-700' : p.currentStock <= p.reorderLevel ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                        {p.currentStock} {p.unit}
                      </Badge>
                    </Td>
                    <Td>{p.reorderLevel}</Td>
                    <Td>
                      {can('products') && (
                        <div className="flex gap-1 justify-end">
                          <button className="p-1.5 text-slate-400 hover:text-indigo-600" onClick={() => setModal({ mode: 'edit', product: p })}><Pencil size={15} /></button>
                          <button className="p-1.5 text-slate-400 hover:text-rose-600" onClick={() => deactivate(p)}><Trash2 size={15} /></button>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Product modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit Product' : 'Add Product'} wide>
        {modal && (
          <form onSubmit={save} className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Field label="Product name"><input name="name" className={inputCls} required defaultValue={modal.product?.name} /></Field></div>
            <Field label="SKU"><input name="sku" className={inputCls} defaultValue={modal.product?.sku} placeholder="TS-BLK-001" /></Field>
            <Field label="Category">
              <select name="categoryId" className={inputCls} defaultValue={modal.product?.categoryId || ''}>
                <option value="">— none —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Cost price (৳)"><input name="costPrice" type="number" step="0.01" min="0" className={inputCls} required defaultValue={modal.product?.costPrice} /></Field>
            <Field label="Selling price (৳)"><input name="sellingPrice" type="number" step="0.01" min="0" className={inputCls} required defaultValue={modal.product?.sellingPrice} /></Field>
            {modal.mode === 'create' && <Field label="Initial stock"><input name="initialStock" type="number" min="0" className={inputCls} defaultValue={0} /></Field>}
            <Field label="Reorder level"><input name="reorderLevel" type="number" min="0" className={inputCls} defaultValue={modal.product?.reorderLevel ?? 10} /></Field>
            <Field label="Lead time (days)" hint="used by AI stock recommendations"><input name="leadTimeDays" type="number" min="1" className={inputCls} defaultValue={modal.product?.leadTimeDays ?? 7} /></Field>
            <Field label="Unit"><input name="unit" className={inputCls} defaultValue={modal.product?.unit || 'pcs'} /></Field>
            <div className="col-span-2"><Field label="Description"><textarea name="description" rows={2} className={inputCls} defaultValue={modal.product?.description} /></Field></div>
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setModal(null)}>Cancel</button>
              <button className={btnPrimary}>{modal.mode === 'edit' ? 'Save changes' : 'Add product'}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Category modal */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title="Add Category">
        <form onSubmit={addCategory} className="space-y-4">
          <Field label="Name"><input name="name" className={inputCls} required /></Field>
          <Field label="Description"><input name="description" className={inputCls} /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setCatModal(false)}>Cancel</button>
            <button className={btnPrimary}>Add</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
