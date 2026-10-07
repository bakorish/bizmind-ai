import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2, Package, Truck, XCircle, RotateCcw, Sparkles, ArrowLeft,
  PhoneCall, CreditCard, MapPin, Clock,
} from 'lucide-react';
import client, { errMsg } from '../api/client';
import { Card, Spinner, Badge, Th, Td, Modal, Field, inputCls, btnPrimary, btnGhost, RiskChip } from '../components/ui';
import { money, dateTime, dateShort, STATUS_META, PAY_METHOD_LABEL, CANCEL_REASONS, RETURN_REASONS, titleize } from '../utils/format';

// Next possible statuses in the pipeline (mirrors backend BR-01 rules).
const NEXT_ACTIONS = {
  pending: [{ to: 'confirmed', label: 'Confirm', icon: CheckCircle2, cls: 'bg-blue-600 hover:bg-blue-700' }, { to: 'cancelled', label: 'Cancel', icon: XCircle, cls: 'bg-rose-100 text-rose-700 hover:bg-rose-200' }],
  confirmed: [{ to: 'processing', label: 'Process', icon: Package, cls: 'bg-indigo-600 hover:bg-indigo-700' }, { to: 'cancelled', label: 'Cancel', icon: XCircle, cls: 'bg-rose-100 text-rose-700 hover:bg-rose-200' }],
  processing: [{ to: 'shipped', label: 'Ship', icon: Truck, cls: 'bg-violet-600 hover:bg-violet-700' }, { to: 'cancelled', label: 'Cancel', icon: XCircle, cls: 'bg-rose-100 text-rose-700 hover:bg-rose-200' }],
  shipped: [{ to: 'out_for_delivery', label: 'Out for delivery', icon: Truck, cls: 'bg-cyan-600 hover:bg-cyan-700' }],
  out_for_delivery: [{ to: 'delivered', label: 'Mark Delivered', icon: CheckCircle2, cls: 'bg-emerald-600 hover:bg-emerald-700' }],
  delivered: [{ to: 'returned', label: 'Record Return', icon: RotateCcw, cls: 'bg-orange-100 text-orange-700 hover:bg-orange-200' }],
};

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [cancelModal, setCancelModal] = useState(false);
  const [returnModal, setReturnModal] = useState(false);
  const [risk, setRisk] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => client.get(`/orders/${id}`).then(({ data }) => setOrder(data.order)).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, [id]);

  const transition = async (to, extra = {}) => {
    setBusy(true);
    try { const { data } = await client.put(`/orders/${id}`, { status: to, ...extra }); setOrder(data.order); setCancelModal(false); }
    catch (err) { alert(errMsg(err)); }
    finally { setBusy(false); }
  };

  const scoreRisk = async () => {
    setBusy(true);
    try {
      const { data } = await client.get(`/ai/risk-prediction`, { params: { orderId: id } });
      setRisk(data.risk.orders?.[0] || null);
      load();
    } catch (err) { alert(errMsg(err)); }
    finally { setBusy(false); }
  };

  const submitReturn = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { data } = await client.post(`/orders/${id}/returns`, {
        items: [{
          productId: Number(fd.get('productId')), quantity: Number(fd.get('quantity')),
          reason: fd.get('reason'), condition: fd.get('condition'), refundStatus: 'refunded',
        }],
        note: fd.get('note'),
      });
      setOrder(data.order); setReturnModal(false);
    } catch (err) { alert(errMsg(err)); }
  };

  if (error) return (
    <div className="space-y-4">
      <Link to="/orders" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"><ArrowLeft size={14} /> Back to orders</Link>
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{error}</div>
    </div>
  );
  if (!order) return <Spinner label="Loading order…" />;

  const items = order.items || [];
  const payment = (order.Payments || [])[0];
  const delivery = order.Delivery;
  const cancellation = order.Cancellation;
  const returns = order.ReturnRecords || [];
  const isFinal = ['cancelled', 'returned'].includes(order.status);
  const actions = NEXT_ACTIONS[order.status] || [];

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/orders" className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"><ArrowLeft size={15} /></Link>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-800">{order.orderNo}</h1>
            <Badge className={STATUS_META[order.status].chip}>{STATUS_META[order.status].label}</Badge>
            {(order.riskLevel || risk) && <RiskChip level={(risk?.riskLevel) || order.riskLevel} score={risk?.riskScore ?? order.riskScore} />}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5"><Clock size={13} /> {dateTime(order.orderDate)} · via {order.placedVia}</div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {!isFinal && order.status !== 'delivered' && (
            <button className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50" onClick={scoreRisk} disabled={busy}>
              <Sparkles size={14} /> {busy ? 'Scoring…' : 'AI Risk Score'}
            </button>
          )}
          {actions.filter((a) => a.to !== 'cancelled').map((a) => (
            <button key={a.to} disabled={busy} onClick={() => (a.to === 'returned' ? setReturnModal(true) : transition(a.to))}
              className={`inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg text-white ${a.cls} disabled:opacity-50`}>
              <a.icon size={15} /> {a.label}
            </button>
          ))}
          {actions.some((a) => a.to === 'cancelled') && (
            <button disabled={busy} onClick={() => setCancelModal(true)}
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-50">
              <XCircle size={15} /> Cancel
            </button>
          )}
        </div>
      </div>

      {risk && (
        <Card className="border-indigo-200 bg-indigo-50/40">
          <div className="p-5 flex flex-wrap gap-8 items-center">
            <div className="flex items-center gap-3">
              <Sparkles className="text-indigo-600" size={20} />
              <div>
                <div className="font-semibold text-slate-800">AI Risk Assessment</div>
                <div className="text-xs text-slate-500">{risk.model || 'XGBoost'} · estimates, not guarantees</div>
              </div>
            </div>
            <div className="flex gap-6">
              <div><div className="text-xs text-slate-500">Cancellation risk</div><div className="text-xl font-bold text-rose-600">{risk.cancellationRiskPct}%</div></div>
              <div><div className="text-xs text-slate-500">Return risk</div><div className="text-xl font-bold text-orange-500">{risk.returnRiskPct}%</div></div>
              <div><div className="text-xs text-slate-500">Overall</div><div className="text-xl font-bold text-indigo-700">{risk.riskLevel}</div></div>
            </div>
            {risk.riskLevel !== 'LOW' && (
              <div className="text-sm text-slate-600 flex items-start gap-2 max-w-md">
                <PhoneCall size={15} className="text-indigo-500 mt-0.5 shrink-0" />
                Recommended: call the customer to confirm before dispatch — high-risk orders are usually COD with new or cancellation-prone customers.
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Items">
            <table className="w-full">
              <thead className="bg-slate-50"><tr><Th>Product</Th><Th>Qty</Th><Th>Unit price</Th><Th>Line total</Th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((it) => (
                  <tr key={it.id}>
                    <Td className="font-medium text-slate-700">{it.productName}</Td>
                    <Td>{it.quantity}</Td>
                    <Td>{money(it.unitPrice)}</Td>
                    <Td className="font-medium">{money(it.lineTotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-4 border-t border-slate-100 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
              {Number(order.discount) > 0 && <div className="flex justify-between text-rose-500"><span>Discount</span><span>−{money(order.discount)}</span></div>}
              <div className="flex justify-between text-slate-500"><span>Delivery charge</span><span>{money(order.deliveryCharge)}</span></div>
              <div className="flex justify-between text-lg font-bold text-slate-800 pt-1.5 border-t border-slate-100"><span>Total</span><span>{money(order.total)}</span></div>
            </div>
          </Card>

          {returns.length > 0 && (
            <Card title="Returns">
              <table className="w-full">
                <thead className="bg-slate-50"><tr><Th>Product</Th><Th>Qty</Th><Th>Reason</Th><Th>Condition</Th><Th>Refund</Th><Th>Date</Th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {returns.map((r) => (
                    <tr key={r.id}>
                      <Td>#{r.productId}</Td><Td>{r.quantity}</Td>
                      <Td>{titleize(r.reason)}</Td>
                      <Td><Badge className={r.condition === 'damaged' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}>{titleize(r.condition)}</Badge></Td>
                      <Td>{money(r.refundAmount)}</Td>
                      <Td className="text-slate-500">{dateShort(r.returnDate)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {cancellation && (
            <Card title="Cancellation">
              <div className="p-5 text-sm space-y-1">
                <div className="font-medium text-slate-700">{CANCEL_REASONS[cancellation.reason] || cancellation.reason}</div>
                <div className="text-slate-500">Cancelled at stage: {titleize(cancellation.stage)} · {dateTime(cancellation.cancelledOn)}</div>
                {cancellation.note && <div className="text-slate-400 italic">"{cancellation.note}"</div>}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Customer">
            <div className="p-5 space-y-2 text-sm">
              <div className="font-semibold text-slate-800">{order.Customer?.name}</div>
              <div className="text-slate-500 flex items-center gap-1.5"><PhoneCall size={13} /> {order.Customer?.phone}</div>
              {order.Customer?.email && <div className="text-slate-500">{order.Customer.email}</div>}
              <div className="text-slate-500 flex items-start gap-1.5"><MapPin size={13} className="mt-0.5 shrink-0" /> {order.shippingAddress}</div>
              <Link to={`/orders?customerId=${order.customerId}`} className="inline-block mt-2 text-xs text-indigo-600 hover:underline">View all their orders →</Link>
            </div>
          </Card>

          <Card title="Payment">
            <div className="p-5 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="font-medium">{PAY_METHOD_LABEL[order.paymentMethod] || order.paymentMethod}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span>
                <Badge className={order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : order.paymentStatus === 'refunded' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}>{titleize(order.paymentStatus)}</Badge>
              </div>
              {payment && order.paymentMethod === 'cod' && (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">Collected</span><span>{money(payment.collectedAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Courier charge</span><span>{money(payment.courierCharge)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Return charge</span><span>{money(payment.returnCharge)}</span></div>
                </>
              )}
              {payment?.paidOn && <div className="flex justify-between"><span className="text-slate-500">Paid on</span><span>{dateTime(payment.paidOn)}</span></div>}
            </div>
          </Card>

          <Card title="Delivery">
            <div className="p-5 space-y-2 text-sm">
              {delivery ? (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">Courier</span><span className="font-medium">{delivery.courierName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Tracking</span><span className="font-mono text-xs">{delivery.trackingCode || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">City</span><span>{delivery.city || '—'}</span></div>
                  {delivery.shippedAt && <div className="flex justify-between"><span className="text-slate-500">Shipped</span><span>{dateShort(delivery.shippedAt)}</span></div>}
                  {delivery.deliveredAt && <div className="flex justify-between"><span className="text-slate-500">Delivered</span><span>{dateShort(delivery.deliveredAt)}</span></div>}
                </>
              ) : <div className="text-slate-400">Not shipped yet</div>}
            </div>
          </Card>

          {order.notes && (
            <Card title="Notes"><div className="p-5 text-sm text-slate-600">{order.notes}</div></Card>
          )}
        </div>
      </div>

      {/* Cancel modal */}
      <Modal open={cancelModal} onClose={() => setCancelModal(false)} title="Cancel order">
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); transition('cancelled', { reason: fd.get('reason'), note: fd.get('note') }); }} className="space-y-4">
          <Field label="Reason">
            <select name="reason" className={inputCls} required defaultValue="customer_changed_mind">
              {Object.entries(CANCEL_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Note (optional)"><input name="note" className={inputCls} /></Field>
          <div className="text-xs text-slate-400">If stock was already deducted, cancelling restores it automatically.</div>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setCancelModal(false)}>Keep order</button>
            <button className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium bg-rose-600 text-white hover:bg-rose-700"><XCircle size={15} /> Cancel order</button>
          </div>
        </form>
      </Modal>

      {/* Return modal */}
      <Modal open={returnModal} onClose={() => setReturnModal(false)} title="Record return">
        <form onSubmit={submitReturn} className="space-y-4">
          <Field label="Product">
            <select name="productId" className={inputCls} required defaultValue={items[0]?.productId}>
              {items.map((it) => <option key={it.id} value={it.productId}>{it.productName}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity"><input name="quantity" type="number" min="1" className={inputCls} required defaultValue={1} /></Field>
            <Field label="Condition" hint="damaged units are not restocked">
              <select name="condition" className={inputCls} defaultValue="resellable">
                <option value="resellable">Resellable (restock)</option>
                <option value="damaged">Damaged (no restock)</option>
              </select>
            </Field>
          </div>
          <Field label="Reason">
            <select name="reason" className={inputCls} defaultValue="size_issue">
              {Object.entries(RETURN_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Note"><input name="note" className={inputCls} /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setReturnModal(false)}>Close</button>
            <button className={btnPrimary}><RotateCcw size={15} /> Record return</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
