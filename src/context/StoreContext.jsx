import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fromProduct, toApiMethod, toCharts, toCustomer, toNotification, toProduct, toPurchase, toSale, toSms, toTopProduct } from '../lib/adapters.js'
import { api, apiAll } from '../lib/api.js'
import { daysUntil } from '../lib/format.js'
import { useAuth } from './AuthContext.jsx'
import { useToast } from './ToastContext.jsx'

/**
 * Holds the signed-in shop's data, loaded from the API. Pages read plain lists from here
 * and change data through `actions`. The server applies the business rules, so after each
 * change the affected lists are fetched again rather than worked out in the browser.
 */

const StoreContext = createContext(null)

const EMPTY = {
  products: [],
  suppliers: [],
  purchases: [],
  customers: [],
  sales: [],
  notifications: [],
  smsLog: [],
  topProducts: [],
  settings: null,
  metrics: null,
  charts: null,
}

const LOADERS = {
  products: async () => (await apiAll('/api/products')).map(toProduct),
  suppliers: async () => (await api('/api/suppliers')).data,
  purchases: async () => (await apiAll('/api/purchases')).map(toPurchase),
  customers: async () => (await apiAll('/api/customers')).map(toCustomer),
  sales: async () => (await apiAll('/api/sales')).map(toSale),
  notifications: async () => (await apiAll('/api/notifications')).map(toNotification),
  smsLog: async () => (await api('/api/customers/sms-log?limit=100')).data.map(toSms),
  topProducts: async () => (await api('/api/dashboard/top-products')).data.map(toTopProduct),
  settings: async () => (await api('/api/settings')).data,
  metrics: async () => (await api('/api/dashboard/metrics')).data,
  charts: async () => toCharts((await api('/api/dashboard/charts')).data),
}

const ALL_KEYS = Object.keys(LOADERS)

const SETTINGS_SAVE_DELAY_MS = 500

/* ---------- Pure helpers, also used by pages ---------- */

export function stockStatus(stock, threshold) {
  if (stock <= 0) return 'out'
  if (stock <= threshold) return 'low'
  return 'in'
}

export function customerBalance(customer) {
  return customer.balance
}

export function customerStatus(customer) {
  if (customer.balance <= 0) return 'settled'
  const days = daysUntil(customer.dueDate)
  if (days < 0) return 'overdue'
  if (days <= 3) return 'soon'
  return 'open'
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

function mergeSettings(base, changes) {
  const merged = { ...base, ...changes }
  for (const section of ['shop', 'sms', 'paymentMethods']) {
    if (changes[section]) merged[section] = { ...base?.[section], ...changes[section] }
  }
  return merged
}

/* ---------- Provider ---------- */

export function StoreProvider({ children }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [data, setData] = useState(EMPTY)
  const [loadedFor, setLoadedFor] = useState(null)
  const [loadError, setLoadError] = useState(null)

  // Responses arriving out of order, or after a sign-out, must not overwrite newer data.
  const session = useRef(0)
  const requestIds = useRef({})
  const pendingSettings = useRef({})
  const settingsTimer = useRef(null)

  const fetchKey = useCallback(async (key) => {
    const owner = session.current
    const requestId = (requestIds.current[key] ?? 0) + 1
    requestIds.current[key] = requestId
    const value = await LOADERS[key]()
    if (owner === session.current && requestId === requestIds.current[key]) {
      setData((current) => ({ ...current, [key]: value }))
    }
  }, [])

  const refresh = useCallback(
    async (...keys) => {
      const results = await Promise.allSettled(keys.map(fetchKey))
      const failed = results.find((result) => result.status === 'rejected')
      if (failed) toast(`Saved, but the screen could not update: ${failed.reason.message}`, 'error')
    },
    [fetchKey, toast],
  )

  const loadAll = useCallback(async () => {
    const owner = session.current
    setLoadError(null)
    try {
      await Promise.all(ALL_KEYS.map(fetchKey))
      if (owner === session.current) setLoadedFor(user?.id ?? null)
    } catch (error) {
      if (owner === session.current) setLoadError(error.message)
    }
  }, [fetchKey, user?.id])

  // Each sign-in starts from nothing, so one shop's data can never show in another's session.
  useEffect(() => {
    session.current += 1
    clearTimeout(settingsTimer.current)
    pendingSettings.current = {}
    setData(EMPTY)
    setLoadedFor(null)
    setLoadError(null)
    if (user?.id) loadAll()
  }, [user?.id, loadAll])

  const compact = Boolean(data.settings?.compact)
  useEffect(() => {
    document.documentElement.classList.toggle('compact', compact)
  }, [compact])

  /* ---------- Settings ---------- */

  const sendPendingSettings = useCallback(async () => {
    clearTimeout(settingsTimer.current)
    const changes = pendingSettings.current
    pendingSettings.current = {}
    // The template field is cleared while someone retypes it, and the server rejects it empty.
    if (changes.sms?.template?.trim() === '') delete changes.sms.template
    if (!Object.keys(changes).length) return
    try {
      await api('/api/settings', { method: 'PUT', body: changes })
    } catch (error) {
      toast(error.message, 'error')
      await refresh('settings')
    }
  }, [refresh, toast])

  /** For toggles and fields that save as they change. The screen updates at once. */
  const updateSettings = useCallback(
    (changes) => {
      setData((current) => ({ ...current, settings: mergeSettings(current.settings, changes) }))
      pendingSettings.current = mergeSettings(pendingSettings.current, changes)
      clearTimeout(settingsTimer.current)
      settingsTimer.current = setTimeout(sendPendingSettings, SETTINGS_SAVE_DELAY_MS)
    },
    [sendPendingSettings],
  )

  /** For forms with a Save button. Resolves once the server has saved, and throws if it refuses. */
  const saveSettings = useCallback(async (changes) => {
    clearTimeout(settingsTimer.current)
    const body = mergeSettings(pendingSettings.current, changes)
    pendingSettings.current = {}
    const { data: saved } = await api('/api/settings', { method: 'PUT', body })
    setData((current) => ({ ...current, settings: saved }))
  }, [])

  /* ---------- Changes ---------- */

  const actions = useMemo(() => {
    /** Runs a change, then reloads what it affects. A 409 means the screen was out of date, so it reloads then too. */
    const change = async (keys, request) => {
      try {
        const result = await request()
        await refresh(...keys)
        return result
      } catch (error) {
        if (error.status === 409) await refresh(...keys)
        throw error
      }
    }
    const post = (path, body) => api(path, { method: 'POST', body })
    const put = (path, body) => api(path, { method: 'PUT', body })
    const sendReadState = (request) =>
      request.catch(async (error) => {
        toast(error.message, 'error')
        await refresh('notifications')
      })

    return {
      saveProduct: (id, values) =>
        change(['products', 'suppliers', 'notifications', 'metrics'], () =>
          id ? put(`/api/products/${id}`, fromProduct(values)) : post('/api/products', fromProduct(values)),
        ),
      deleteProduct: (id) => change(['products', 'notifications', 'metrics'], () => api(`/api/products/${id}`, { method: 'DELETE' })),
      importProducts: (rows) => change(['products', 'suppliers', 'notifications', 'metrics'], () => post('/api/products/import', { products: rows.map(fromProduct) })),

      recordSale: ({ method, ...sale }) =>
        change(['products', 'sales', 'customers', 'notifications', 'metrics', 'charts', 'topProducts'], async () => {
          const { data: saved } = await post('/api/sales', { ...sale, paymentMethod: toApiMethod(method) })
          return toSale(saved)
        }),

      addPurchase: (purchase) =>
        change(['products', 'purchases', 'suppliers', 'notifications', 'metrics', 'charts'], async () => {
          const { data: saved } = await post('/api/purchases', purchase)
          return toPurchase(saved)
        }),
      payPurchase: (uuid, amount) => change(['purchases', 'notifications', 'metrics'], () => post(`/api/purchases/${uuid}/pay-due`, { amount })),

      addCustomer: (customer) => change(['customers', 'notifications', 'metrics'], () => post('/api/customers', customer)),
      addCredit: (id, credit) => change(['customers', 'notifications', 'metrics'], () => post(`/api/customers/${id}/add-credit`, credit)),
      payDebt: (id, { amount, method }) =>
        change(['customers', 'sales', 'notifications', 'metrics'], () => post(`/api/customers/${id}/pay-debt`, { amount, method: toApiMethod(method) })),
      sendSms: (id, body) => change(['smsLog'], () => post(`/api/customers/${id}/send-sms`, { body })),

      setNotificationRead: (id, read) => {
        setData((current) => ({ ...current, notifications: current.notifications.map((n) => (n.id === id ? { ...n, read } : n)) }))
        return sendReadState(put(`/api/notifications/${id}/read`, { isRead: read }))
      },
      markAllNotificationsRead: () => {
        setData((current) => ({ ...current, notifications: current.notifications.map((n) => ({ ...n, read: true })) }))
        return sendReadState(put('/api/notifications/read-all'))
      },

      updateSettings,
      saveSettings,
    }
  }, [refresh, saveSettings, toast, updateSettings])

  /* ---------- Derived values ---------- */

  const derived = useMemo(() => {
    const threshold = data.settings?.lowStockThreshold ?? 0
    const counts = { in: 0, low: 0, out: 0 }
    let stockValue = 0
    data.products.forEach((p) => {
      counts[stockStatus(p.stock, threshold)] += 1
      stockValue += p.stock * p.buyPrice
    })

    return {
      threshold,
      inventory: { total: data.products.length, inStock: counts.in, low: counts.low, out: counts.out, value: stockValue },
      receivable: data.metrics?.receivable ?? 0,
      supplierDue: data.purchases.reduce((sum, po) => sum + (po.total - po.paid), 0),
      unread: data.notifications.filter((n) => !n.read).length,
      netProfit: data.metrics?.netProfit ?? 0,
    }
  }, [data.settings?.lowStockThreshold, data.products, data.metrics, data.purchases, data.notifications])

  const finance = useMemo(
    () => ({
      revenue: data.metrics?.totalRevenue ?? 0,
      expense: data.metrics?.totalExpense ?? 0,
      capital: data.metrics?.businessCapital ?? 0,
    }),
    [data.metrics],
  )

  const ready = Boolean(user?.id) && loadedFor === user.id

  const value = useMemo(
    () => ({ ...data, finance, derived, actions, ready, loadError, retryLoad: loadAll }),
    [data, finance, derived, actions, ready, loadError, loadAll],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}
