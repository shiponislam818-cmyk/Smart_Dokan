import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, CircleCheck, CircleDollarSign, Clock, Plus, ShoppingCart, Trash2, Truck, Wallet } from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import GlassCard, { CardHeader } from '../components/ui/GlassCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import MetricCard from '../components/ui/MetricCard.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/ui/PageHeader.jsx'
import { Field, Select } from '../components/ui/Form.jsx'
import { uid, useStore } from '../context/StoreContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { formatDate, number, taka, toInputDate } from '../lib/format.js'

const itemCount = (po) => po.lines.reduce((sum, line) => sum + line.qty, 0)

function statusOf(po) {
  if (po.paid >= po.total) return <Badge tone="emerald">Paid</Badge>
  return <Badge tone="orange">{po.paid > 0 ? 'Partial' : 'Unpaid'}</Badge>
}

/* ---------- Add purchase ---------- */

function AddPurchaseModal({ reorderId, onClose }) {
  const { products, suppliers, actions } = useStore()
  const { toast } = useToast()

  const blankLine = (product = products[0]) => ({ key: uid(), productId: product?.id ?? '', qty: '', cost: product ? String(product.buyPrice) : '' })
  const reorderProduct = products.find((p) => p.id === reorderId)

  const [supplier, setSupplier] = useState(reorderProduct?.supplier ?? suppliers[0]?.name ?? 'new')
  const [newSupplier, setNewSupplier] = useState('')
  const [date, setDate] = useState(toInputDate())
  const [paid, setPaid] = useState('')
  const [lines, setLines] = useState([blankLine(reorderProduct)])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const updateLine = (key, changes) => setLines((list) => list.map((line) => (line.key === key ? { ...line, ...changes } : line)))
  const total = lines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.cost) || 0), 0)
  const paidValue = paid === '' ? 0 : Number(paid)
  const due = Math.max(0, total - (paidValue || 0))

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    const next = {}
    const supplierName = supplier === 'new' ? newSupplier.trim() : supplier
    if (!supplierName) next.supplier = 'Enter the supplier name.'
    if (!date) next.date = 'Choose a date.'
    if (lines.some((line) => !(Number(line.qty) > 0) || !Number.isInteger(Number(line.qty)))) next.lines = 'Each item needs a whole-number quantity above 0.'
    else if (lines.some((line) => !(Number(line.cost) >= 0) || line.cost === '')) next.lines = 'Each item needs a unit cost.'
    if (paidValue < 0) next.paid = 'Paid amount cannot be negative.'
    else if (paidValue > total) next.paid = `Paid amount cannot be more than ${taka(total)}.`
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    try {
      const purchase = await actions.addPurchase({
        supplierName,
        // Today's purchases use the server's clock, since noon today may still be in the future.
        date: date === toInputDate() ? undefined : new Date(`${date}T12:00:00`).toISOString(),
        paidAmount: paidValue,
        items: lines.map((line) => ({ productId: line.productId, quantity: Number(line.qty), unitCost: Number(line.cost) })),
      })
      toast(`${purchase.id} recorded and stock updated.`)
      onClose()
    } catch (error) {
      toast(error.message, 'error')
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Add Purchase"
      subtitle="Recording a purchase adds its items to stock."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="purchase-form" variant="primary" loading={saving}>
            Save Purchase
          </Button>
        </>
      }
    >
      <form id="purchase-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            {suppliers.map((s) => (
              <option key={s.id}>{s.name}</option>
            ))}
            <option value="new">+ New supplier</option>
          </Select>
          <Field label="Purchase date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
          {supplier === 'new' && <Field className="sm:col-span-2" label="New supplier name" value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} error={errors.supplier} />}
        </div>

        <fieldset>
          <legend className="field-label">Items</legend>
          <div className="space-y-2.5">
            {lines.map((line) => (
              <div key={line.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 sm:grid-cols-[minmax(0,2fr)_90px_120px_auto]">
                <Select
                  className="col-span-3 sm:col-span-1"
                  aria-label="Product"
                  value={line.productId}
                  onChange={(e) => {
                    const product = products.find((p) => p.id === e.target.value)
                    updateLine(line.key, { productId: e.target.value, cost: product ? String(product.buyPrice) : line.cost })
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Field aria-label="Quantity" type="number" min="1" inputMode="numeric" placeholder="Qty" value={line.qty} onChange={(e) => updateLine(line.key, { qty: e.target.value })} />
                <Field aria-label="Unit cost in taka" type="number" min="0" inputMode="decimal" placeholder="Unit cost" value={line.cost} onChange={(e) => updateLine(line.key, { cost: e.target.value })} />
                <Button size="icon" className="!h-11 !w-11" aria-label="Remove item" disabled={lines.length === 1} onClick={() => setLines((list) => list.filter((l) => l.key !== line.key))}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
          {errors.lines && <p className="mt-2 text-xs font-medium text-[#FDA4B4]">{errors.lines}</p>}
          <Button size="sm" variant="ghost" className="mt-2" icon={Plus} onClick={() => setLines((list) => [...list, blankLine()])}>
            Add another item
          </Button>
        </fieldset>

        <div className="grid items-start gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
          <Field label="Amount paid now (৳)" type="number" min="0" inputMode="decimal" placeholder="0" value={paid} onChange={(e) => setPaid(e.target.value)} error={errors.paid} />
          <dl className="space-y-1 text-[13.5px] sm:pt-6">
            <div className="flex justify-between font-bold text-frost">
              <dt>Total</dt>
              <dd className="tabular-nums">{taka(total)}</dd>
            </div>
            <div className="flex justify-between text-frost-soft">
              <dt>Supplier due</dt>
              <dd className="tabular-nums">{taka(due)}</dd>
            </div>
          </dl>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- View purchase and pay supplier ---------- */

function ViewPurchaseModal({ purchaseId, onClose }) {
  const { purchases, actions } = useStore()
  const { toast } = useToast()
  const purchase = purchases.find((po) => po.id === purchaseId)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!purchase) return null
  const due = purchase.total - purchase.paid

  const pay = async (event) => {
    event.preventDefault()
    if (saving) return
    const value = Number(amount)
    if (!(value > 0)) return setError('Enter an amount above 0.')
    if (value > due) return setError(`The most you can pay is ${taka(due)}.`)
    setSaving(true)
    try {
      await actions.payPurchase(purchase.uuid, value)
      toast(`${purchase.supplier}: ${taka(value)} paid.`)
      setAmount('')
      setError('')
    } catch (failure) {
      setError(failure.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={purchase.id} subtitle={`${purchase.supplier} • ${formatDate(purchase.date)}`} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="!pl-0">
                Item
              </th>
              <th scope="col" className="num">
                Qty
              </th>
              <th scope="col" className="num">
                Unit Cost
              </th>
              <th scope="col" className="num !pr-0">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {purchase.lines.map((line, i) => (
              <tr key={`${line.name}-${i}`}>
                <td className="!pl-0 font-semibold text-frost">{line.name}</td>
                <td className="num">
                  {number(line.qty)} {line.unit}
                </td>
                <td className="num">{taka(line.cost)}</td>
                <td className="num !pr-0">{taka(line.qty * line.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          ['Total', purchase.total],
          ['Paid', purchase.paid],
          ['Due', due],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <dt className="eyebrow">{label}</dt>
            <dd className="mt-1 text-[15px] font-bold text-frost">{taka(value)}</dd>
          </div>
        ))}
      </dl>

      {due > 0 ? (
        <form onSubmit={pay} noValidate className="mt-4 flex flex-wrap items-start gap-2.5">
          <Field className="min-w-[180px] flex-1" aria-label="Payment amount in taka" type="number" min="1" inputMode="decimal" placeholder={`Pay up to ${taka(due)}`} value={amount} onChange={(e) => setAmount(e.target.value)} error={error} />
          <Button className="!h-11" onClick={() => setAmount(String(due))}>
            Full amount
          </Button>
          <Button type="submit" variant="primary" className="!h-11" icon={CircleDollarSign} loading={saving}>
            Pay Supplier
          </Button>
        </form>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-[13.5px] font-semibold text-[#6EE7B7]">
          <CircleCheck className="h-4 w-4" aria-hidden="true" /> This purchase is fully paid.
        </p>
      )}
    </Modal>
  )
}

/* ---------- Page ---------- */

export default function Purchases() {
  const { purchases, suppliers, products, derived } = useStore()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [adding, setAdding] = useState(false)
  const [reorderId, setReorderId] = useState(null)
  const [viewingId, setViewingId] = useState(null)

  // "Reorder" in Inventory opens the form with that product filled in.
  useEffect(() => {
    if (location.state?.reorder) {
      setReorderId(location.state.reorder)
      setAdding(true)
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
  }, [location, navigate])

  // Notifications and global search link straight to one purchase order.
  useEffect(() => {
    const id = params.get('view')
    if (id) setViewingId(id)
  }, [params])

  const closeView = () => {
    setViewingId(null)
    if (params.get('view')) setParams({}, { replace: true })
  }

  const totals = useMemo(
    () => ({
      total: purchases.reduce((sum, po) => sum + po.total, 0),
      paid: purchases.reduce((sum, po) => sum + po.paid, 0),
      pending: purchases.filter((po) => po.paid < po.total).length,
    }),
    [purchases],
  )

  const supplierRows = useMemo(
    () =>
      suppliers.map((supplier) => {
        const orders = purchases.filter((po) => po.supplier === supplier.name)
        return {
          ...supplier,
          orders: orders.length,
          total: orders.reduce((sum, po) => sum + po.total, 0),
          due: orders.reduce((sum, po) => sum + po.total - po.paid, 0),
        }
      }),
    [suppliers, purchases],
  )

  return (
    <>
      <PageHeader
        title="Purchases & Suppliers"
        subtitle="Restock with confidence. Stay on top of every order."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            disabled={!products.length}
            onClick={() => {
              setReorderId(null)
              setAdding(true)
            }}
          >
            Add Purchase
          </Button>
        }
      />

      <section aria-label="Purchase summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Purchases" value={taka(totals.total)} icon={ShoppingCart} glow="cyan" />
        <MetricCard label="Paid" value={taka(totals.paid)} icon={Wallet} glow="emerald" />
        <MetricCard label="Pending Orders" value={number(totals.pending)} icon={Clock} glow="indigo" />
        <MetricCard label="Pending Supplier Dues" value={taka(derived.supplierDue)} icon={Truck} glow="orange" />
      </section>

      <GlassCard className="overflow-hidden">
        <CardHeader className="p-5 pb-3" title="Purchase Orders" />
        {purchases.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No purchases yet" message="Record your first purchase to start tracking supplier dues." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">PO ID</th>
                  <th scope="col">Supplier Name</th>
                  <th scope="col" className="num">
                    Items
                  </th>
                  <th scope="col" className="num">
                    Total Amount
                  </th>
                  <th scope="col" className="num">
                    Paid
                  </th>
                  <th scope="col" className="num">
                    Due
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Date</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((po) => (
                  <tr key={po.id}>
                    <td className="font-semibold text-frost">{po.id}</td>
                    <td>{po.supplier}</td>
                    <td className="num">{number(itemCount(po))}</td>
                    <td className="num font-semibold text-frost">{taka(po.total)}</td>
                    <td className="num">{taka(po.paid)}</td>
                    <td className="num">{taka(po.total - po.paid)}</td>
                    <td>{statusOf(po)}</td>
                    <td>{formatDate(po.date)}</td>
                    <td>
                      <Button size="sm" trailing={ChevronRight} onClick={() => setViewingId(po.id)} aria-label={`View ${po.id}`}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <section aria-labelledby="suppliers-heading">
        <h2 id="suppliers-heading" className="mb-3 text-[15px] font-bold text-frost">
          Suppliers
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {supplierRows.map((supplier) => (
            <GlassCard key={supplier.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-brand-cyan">
                  <Truck className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-frost">{supplier.name}</p>
                  <p className="truncate text-xs text-frost-muted">{[supplier.contact, supplier.phone].filter(Boolean).join(' • ') || 'No contact details yet'}</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-xs text-frost-muted">
                <div>
                  <dt>Orders</dt>
                  <dd className="mt-0.5 text-[13.5px] font-bold text-frost">{number(supplier.orders)}</dd>
                </div>
                <div>
                  <dt>Purchased</dt>
                  <dd className="mt-0.5 text-[13.5px] font-bold text-frost">{taka(supplier.total)}</dd>
                </div>
                <div>
                  <dt>Due</dt>
                  <dd className={`mt-0.5 text-[13.5px] font-bold ${supplier.due > 0 ? 'text-[#FDBA74]' : 'text-[#6EE7B7]'}`}>{taka(supplier.due)}</dd>
                </div>
              </dl>
            </GlassCard>
          ))}
        </div>
      </section>

      {adding && <AddPurchaseModal reorderId={reorderId} onClose={() => setAdding(false)} />}
      {viewingId && <ViewPurchaseModal purchaseId={viewingId} onClose={closeView} />}
    </>
  )
}
