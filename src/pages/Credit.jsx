import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BellRing, CircleCheck, CircleDollarSign, History, Landmark, MessageSquareText, Plus, Send, SearchX, TriangleAlert, Users } from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import GlassCard, { CardHeader } from '../components/ui/GlassCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import MetricCard from '../components/ui/MetricCard.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/ui/PageHeader.jsx'
import { Field, SearchInput, SegmentedControl, Select } from '../components/ui/Form.jsx'
import { customerBalance, customerStatus, useStore } from '../context/StoreContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { PAYMENT_CHANNELS } from '../data/constants.js'
import { daysFromNow, daysUntil, formatDate, formatDateTime, initials, number, taka, timeAgo, toInputDate } from '../lib/format.js'

const STATUS = {
  overdue: { tone: 'rose', label: 'Overdue' },
  soon: { tone: 'orange', label: 'Due soon' },
  open: { tone: 'cyan', label: 'On track' },
  settled: { tone: 'emerald', label: 'Settled' },
}

const SMS_STATUS = {
  queued: { tone: 'slate', label: 'Queued' },
  sent: { tone: 'cyan', label: 'Sent' },
  delivered: { tone: 'emerald', label: 'Delivered' },
  failed: { tone: 'rose', label: 'Failed' },
}

const sumEntries = (customer, type) => customer.ledger.filter((entry) => entry.type === type).reduce((sum, entry) => sum + entry.amount, 0)

function fillTemplate(template, customer, shopName) {
  return template
    .replaceAll('{name}', customer.name)
    .replaceAll('{shop}', shopName)
    .replaceAll('{amount}', taka(customerBalance(customer)))
    .replaceAll('{date}', formatDate(customer.dueDate))
}

/* ---------- Modals ---------- */

function PaymentModal({ customer, onClose }) {
  const { actions, settings } = useStore()
  const { toast } = useToast()
  const balance = customerBalance(customer)
  const [kind, setKind] = useState('full')
  const [amount, setAmount] = useState(String(balance))
  const [method, setMethod] = useState('Cash')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const channels = PAYMENT_CHANNELS.filter((channel) => {
    if (channel === 'Cash') return true
    return settings.paymentMethods[channel === 'Card' ? 'Card API' : channel]?.enabled
  })

  const chooseKind = (next) => {
    setKind(next)
    setAmount(next === 'full' ? String(balance) : '')
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    const value = Number(amount)
    if (!(value > 0)) return setError('Enter an amount above 0.')
    if (value > balance) return setError(`The balance is only ${taka(balance)}.`)
    setSaving(true)
    try {
      await actions.payDebt(customer.id, { amount: value, method })
      toast(value === balance ? `${customer.name}'s balance is settled.` : `${taka(value)} recorded. ${taka(balance - value)} still outstanding.`)
      onClose()
    } catch (failure) {
      setError(failure.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Record Payment"
      subtitle={`${customer.name} owes ${taka(balance)}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="payment-form" variant="primary" icon={CircleDollarSign} loading={saving}>
            Record Payment
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} noValidate className="space-y-4">
        <SegmentedControl
          label="Settlement type"
          className="w-full"
          options={[
            { value: 'full', label: 'Full payment' },
            { value: 'partial', label: 'Partial payment' },
          ]}
          value={kind}
          onChange={chooseKind}
        />
        <Field label="Amount (৳)" type="number" min="1" inputMode="decimal" value={amount} readOnly={kind === 'full'} onChange={(e) => setAmount(e.target.value)} error={error} />
        <Select label="Received via" value={method} onChange={(e) => setMethod(e.target.value)}>
          {channels.map((channel) => (
            <option key={channel}>{channel}</option>
          ))}
        </Select>
      </form>
    </Modal>
  )
}

function SmsModal({ customer, onClose, onSend }) {
  const { settings } = useStore()
  const [body, setBody] = useState(() => fillTemplate(settings.sms.template, customer, settings.shop.name))
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!body.trim()) return setError('Write a message first.')
    setSending(true)
    try {
      await onSend(customer, body.trim())
      onClose()
    } catch (failure) {
      setError(failure.message)
      setSending(false)
    }
  }

  return (
    <Modal
      title="Send SMS Reminder"
      subtitle={`To ${customer.name} • ${customer.phone}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Send} loading={sending} onClick={send}>
            Send via Twilio
          </Button>
        </>
      }
    >
      <label htmlFor="sms-body" className="field-label">
        Message
      </label>
      <textarea id="sms-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} className={`field !h-auto resize-y py-3 leading-relaxed ${error ? 'field-error' : ''}`} />
      <div className="mt-1.5 flex justify-between gap-3 text-xs text-frost-muted">
        <span>{error || 'Unless the server is set to live SMS, this is simulated and no real SMS is sent.'}</span>
        <span className="tabular-nums">{body.length} characters</span>
      </div>
    </Modal>
  )
}

function HistoryModal({ customer, onClose }) {
  const entries = [...customer.ledger].sort((a, b) => new Date(b.date) - new Date(a.date))
  return (
    <Modal title="Credit History" subtitle={`${customer.name} • Balance ${taka(customerBalance(customer))}`} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      {entries.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" />
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-frost">{entry.note}</span>
                <span className="block text-xs text-frost-muted">{formatDateTime(entry.date)}</span>
              </span>
              <span className={`shrink-0 text-[13.5px] font-bold tabular-nums ${entry.type === 'payment' ? 'text-[#6EE7B7]' : 'text-[#FDBA74]'}`}>
                {entry.type === 'payment' ? '-' : '+'}
                {taka(entry.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function AddCreditModal({ onClose }) {
  const { customers, actions } = useStore()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? 'new')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(toInputDate(daysFromNow(7)))
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const isNew = customerId === 'new'

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    const next = {}
    if (isNew && !name.trim()) next.name = 'Enter the customer name.'
    if (isNew && !phone.trim()) next.phone = 'A phone number is needed for reminders.'
    if (amount !== '' && !(Number(amount) > 0)) next.amount = 'Enter an amount above 0.'
    if (!isNew && amount === '') next.amount = 'Enter an amount above 0.'
    if (amount !== '' && !dueDate) next.dueDate = 'Choose a due date.'
    setErrors(next)
    if (Object.keys(next).length) return

    const value = Number(amount)
    // The date can be blank for a new customer with no opening balance.
    const dueIso = dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : daysFromNow(7)
    const entryNote = note.trim() || 'Manual credit entry'

    setSaving(true)
    try {
      if (isNew) {
        await actions.addCustomer({ name: name.trim(), phone: phone.trim(), openingCredit: value, dueDate: dueIso, note: entryNote })
        toast(`${name.trim()} added to credit records.`)
      } else {
        await actions.addCredit(customerId, { amount: value, dueDate: dueIso, note: entryNote })
        toast(`${taka(value)} added to the customer's balance.`)
      }
      onClose()
    } catch (error) {
      toast(error.message, 'error')
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Add Credit"
      subtitle="Sales made on credit are added here automatically."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="credit-form" variant="primary" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="credit-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Select className="sm:col-span-2" label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="new">+ New customer</option>
        </Select>
        {isNew && (
          <>
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
            <Field label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
          </>
        )}
        <Field label={isNew ? 'Opening balance (৳, optional)' : 'Credit amount (৳)'} type="number" min="1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
        <Field label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} error={errors.dueDate} />
        <Field className="sm:col-span-2" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monthly groceries" />
      </form>
    </Modal>
  )
}

/* ---------- Page ---------- */

export default function Credit() {
  const { customers, settings, smsLog, actions } = useStore()
  const { toast } = useToast()
  const [params] = useSearchParams()

  const [sendingReminders, setSendingReminders] = useState(false)
  const [search, setSearch] = useState(params.get('q') || '')
  const [paying, setPaying] = useState(null)
  const [messaging, setMessaging] = useState(null)
  const [historyId, setHistoryId] = useState(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setSearch(params.get('q') || '')
  }, [params])

  const smsOn = settings.sms.enabled

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const order = { overdue: 0, soon: 1, open: 2, settled: 3 }
    return customers
      .filter((c) => !q || `${c.name} ${c.phone}`.toLowerCase().includes(q))
      .sort((a, b) => order[customerStatus(a)] - order[customerStatus(b)])
  }, [customers, search])

  const summary = useMemo(() => {
    const outstanding = customers.reduce((sum, c) => sum + Math.max(0, customerBalance(c)), 0)
    const collected = customers.reduce((sum, c) => sum + sumEntries(c, 'payment'), 0)
    const overdue = customers.filter((c) => customerStatus(c) === 'overdue')
    return { outstanding, collected, overdue: overdue.length }
  }, [customers])

  // Who the rules in Settings say should be reminded today.
  const dueReminders = useMemo(() => {
    if (!smsOn) return []
    return customers.filter((c) => {
      const status = customerStatus(c)
      if (status === 'settled') return false
      if (status === 'overdue') return settings.sms.overdueDaily
      return settings.sms.beforeDue && daysUntil(c.dueDate) <= settings.sms.daysBefore
    })
  }, [customers, settings.sms, smsOn])

  const runReminders = async () => {
    setSendingReminders(true)
    const results = await Promise.allSettled(dueReminders.map((customer) => actions.sendSms(customer.id)))
    setSendingReminders(false)
    const sent = results.filter((result) => result.status === 'fulfilled').length
    const failed = results.length - sent
    toast(`${sent} reminder${sent === 1 ? '' : 's'} sent${failed ? `, ${failed} failed` : ''}.`, failed ? 'error' : 'info')
  }

  const historyCustomer = customers.find((c) => c.id === historyId)

  return (
    <>
      <PageHeader
        title="Customer Credit & Dues"
        subtitle="Know who owes what, and collect it without the awkward conversation."
        actions={
          <>
            <Button icon={BellRing} disabled={!dueReminders.length} loading={sendingReminders} onClick={runReminders} title={smsOn ? undefined : 'SMS reminders are turned off in Settings'}>
              Send Due Reminders{dueReminders.length ? ` (${dueReminders.length})` : ''}
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
              Add Credit
            </Button>
          </>
        }
      />

      <section aria-label="Credit summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Outstanding" value={taka(summary.outstanding)} icon={Landmark} glow="orange" />
        <MetricCard label="Overdue Accounts" value={number(summary.overdue)} icon={TriangleAlert} glow="rose" />
        <MetricCard label="Collected" value={taka(summary.collected)} icon={CircleCheck} glow="emerald" />
        <MetricCard label="Customers" value={number(customers.length)} icon={Users} glow="cyan" />
      </section>

      {!smsOn && (
        <p className="glass flex flex-wrap items-center gap-2 px-4 py-3 text-[13.5px] text-frost-soft">
          <TriangleAlert className="h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />
          SMS reminders are turned off.
          <Link to="/settings" className="font-semibold text-brand-cyan hover:underline">
            Turn them on in Settings
          </Link>
        </p>
      )}

      <GlassCard className="overflow-hidden">
        <div className="border-b border-white/10 p-4">
          <SearchInput label="Search customers" placeholder="Search customers by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={SearchX} title="No customers match" message="Try a different name or phone number." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col" className="num">
                    Total Credit
                  </th>
                  <th scope="col" className="num">
                    Paid
                  </th>
                  <th scope="col" className="num">
                    Outstanding
                  </th>
                  <th scope="col">Due Date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((customer) => {
                  const balance = customerBalance(customer)
                  const status = STATUS[customerStatus(customer)]
                  return (
                    <tr key={customer.id}>
                      <td>
                        <span className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-cyan/30 to-indigo-500/30 text-xs font-bold text-frost ring-1 ring-white/15">{initials(customer.name)}</span>
                          <span>
                            <span className="block font-semibold text-frost">{customer.name}</span>
                            <span className="block text-xs text-frost-muted">{customer.phone}</span>
                          </span>
                        </span>
                      </td>
                      <td className="num">{taka(sumEntries(customer, 'credit'))}</td>
                      <td className="num">{taka(sumEntries(customer, 'payment'))}</td>
                      <td className="num font-bold text-frost">{taka(balance)}</td>
                      <td>{balance > 0 ? formatDate(customer.dueDate) : '-'}</td>
                      <td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5">
                          <Button size="sm" variant="primary" disabled={balance <= 0} onClick={() => setPaying(customer)} aria-label={`Record payment from ${customer.name}`}>
                            Record Payment
                          </Button>
                          <Button size="sm" icon={MessageSquareText} disabled={balance <= 0 || !smsOn} onClick={() => setMessaging(customer)} aria-label={`Send SMS reminder to ${customer.name}`}>
                            SMS
                          </Button>
                          <Button size="icon" title="Credit history" aria-label={`Credit history for ${customer.name}`} onClick={() => setHistoryId(customer.id)}>
                            <History className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <CardHeader
          title="SMS Activity"
          subtitle={
            smsOn
              ? `Send Due Reminders covers customers ${settings.sms.beforeDue ? `due within ${settings.sms.daysBefore} days` : 'not yet due: no'}${settings.sms.overdueDaily ? ' and anyone overdue.' : '.'}`
              : 'Reminders are off.'
          }
          action={
            <Link to="/settings" className="text-[13px] font-semibold text-frost-muted transition hover:text-brand-cyan">
              Reminder settings
            </Link>
          }
        />
        {smsLog.length === 0 ? (
          <EmptyState icon={MessageSquareText} title="No messages yet" message="Reminders you send will appear here with their delivery status." />
        ) : (
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-0.5">
            {smsLog.map((message) => {
              const status = SMS_STATUS[message.status] ?? { tone: 'slate', label: message.status }
              return (
                <li key={message.sid} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13.5px] font-semibold text-frost">
                      {message.customer} <span className="font-normal text-frost-muted">• {message.to}</span>
                    </p>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-frost-muted">{timeAgo(message.date)}</span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-frost-soft">{message.body}</p>
                  <p className="mt-1 truncate font-mono text-[11px] text-frost-muted">SID {message.sid}</p>
                </li>
              )
            })}
          </ul>
        )}
      </GlassCard>

      {paying && <PaymentModal customer={paying} onClose={() => setPaying(null)} />}
      {messaging && (
        <SmsModal
          customer={messaging}
          onClose={() => setMessaging(null)}
          onSend={async (customer, body) => {
            await actions.sendSms(customer.id, body)
            toast(`Reminder sent to ${customer.name}.`, 'info')
          }}
        />
      )}
      {historyCustomer && <HistoryModal customer={historyCustomer} onClose={() => setHistoryId(null)} />}
      {adding && <AddCreditModal onClose={() => setAdding(false)} />}
    </>
  )
}
