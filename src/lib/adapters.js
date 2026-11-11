/** Translates between the API's field names and the shapes the pages use. */

const METHOD_TO_API = {
  Cash: 'CASH',
  bKash: 'BKASH',
  Nagad: 'NAGAD',
  Rocket: 'ROCKET',
  Upay: 'UPAY',
  'Bangla QR': 'BANGLA_QR',
  Card: 'CARD',
  Credit: 'CREDIT',
}
const METHOD_FROM_API = Object.fromEntries(Object.entries(METHOD_TO_API).map(([label, value]) => [value, label]))

export const toApiMethod = (label) => METHOD_TO_API[label] ?? 'CASH'

const NOTIFICATION_CATEGORY = {
  LOW_STOCK: 'stock',
  REORDER: 'reorder',
  DEBT_DUE: 'customer',
  PAYMENT_RECEIVED: 'customer',
  SUPPLIER_DUE: 'supplier',
}

const ROLE_LABELS = { ADMIN: 'Shop owner', MANAGER: 'Manager' }

export const toUser = (user) => ({ ...user, role: ROLE_LABELS[user.role] ?? user.role })

export const toProduct = (product) => ({
  id: product.id,
  sku: `PRD-${product.id.slice(0, 8).toUpperCase()}`,
  name: product.productName,
  category: product.category,
  stock: product.stockQty,
  buyPrice: product.buyingPrice,
  sellPrice: product.sellingPrice,
  supplier: product.supplier?.name ?? '',
  supplierId: product.supplierId,
})

export const fromProduct = (values) => ({
  productName: values.name,
  category: values.category,
  stockQty: values.stock,
  buyingPrice: values.buyPrice,
  sellingPrice: values.sellPrice,
  supplierName: values.supplier,
})

/** `id` is the invoice number the pages show and link to. `uuid` is the database id. */
export const toSale = (sale) => ({
  id: sale.saleNumber,
  uuid: sale.id,
  customerId: sale.customerId,
  customer: sale.customer?.name ?? 'Walk-in customer',
  method: METHOD_FROM_API[sale.paymentMethod] ?? sale.paymentMethod,
  date: sale.createdAt,
  items: sale.items.map((item) => ({
    productId: item.productId,
    name: item.product.productName,
    qty: item.quantity,
    price: item.unitPrice,
  })),
  subtotal: sale.totalAmount + sale.discount,
  discount: sale.discount,
  total: sale.totalAmount,
  paid: sale.paidAmount,
  due: sale.dueAmount,
})

/** `id` is the purchase order number. `uuid` is the database id. */
export const toPurchase = (purchase) => ({
  id: purchase.poNumber,
  uuid: purchase.id,
  supplier: purchase.supplier.name,
  date: purchase.createdAt,
  total: purchase.totalAmount,
  paid: purchase.paidAmount,
  lines: purchase.items.map((item) => ({
    productId: item.productId,
    name: item.product.productName,
    qty: item.quantity,
    unit: 'pcs',
    cost: item.unitCost,
  })),
})

export const toCustomer = (customer) => ({
  id: customer.id,
  name: customer.name,
  phone: customer.phone,
  balance: customer.totalCreditDue,
  dueDate: customer.dueDate,
  ledger: (customer.ledger ?? []).map((entry) => ({
    id: entry.id,
    type: entry.type === 'PAYMENT' ? 'payment' : 'credit',
    amount: entry.amount,
    note: entry.note,
    date: entry.createdAt,
  })),
})

export const toNotification = (notification) => ({
  id: notification.id,
  category: NOTIFICATION_CATEGORY[notification.type] ?? 'stock',
  title: notification.title,
  message: notification.message,
  date: notification.createdAt,
  read: notification.isRead,
  link: notification.link,
})

export const toSms = (message) => ({
  sid: message.sid ?? message.id,
  customer: message.customer?.name ?? '',
  to: message.to,
  body: message.body,
  date: message.createdAt,
  status: message.status,
})

export const toTopProduct = (product) => ({
  id: product.id,
  name: product.productName,
  category: product.category,
  unitsSold: product.unitsSold,
  revenue: product.revenue,
  trend: product.trend,
})

/** The pages call the daily series "today". */
export const toCharts = ({ daily, weekly, monthly }) => ({ today: daily, weekly, monthly })
