import { useNavigate } from 'react-router-dom'
import { CalendarDays, Landmark, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import MetricCard from '../components/ui/MetricCard.jsx'
import RevenueChart from '../components/charts/RevenueChart.jsx'
import ProfitLossCard from '../components/dashboard/ProfitLossCard.jsx'
import InventoryOverview from '../components/dashboard/InventoryOverview.jsx'
import TopProducts from '../components/dashboard/TopProducts.jsx'
import RecentTransactions from '../components/dashboard/RecentTransactions.jsx'
import SmartAlerts from '../components/dashboard/SmartAlerts.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { taka } from '../lib/format.js'

function currentWeekRange() {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const short = { month: 'short', day: 'numeric' }
  return `${monday.toLocaleDateString('en-US', short)} - ${sunday.toLocaleDateString('en-US', { ...short, year: 'numeric' })}`
}

export default function Dashboard() {
  const { user } = useAuth()
  const { finance, derived, metrics, charts } = useStore()
  const navigate = useNavigate()
  const { revenueChange, expenseChange, netProfitChange } = metrics.weekOverWeek
  const { revenue, expense } = charts.weekly
  const profitSpark = revenue.map((value, i) => value - expense[i])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="sr-only">Dashboard</h1>
        {/* The top bar hides its greeting on phones, so it moves here. */}
        <p className="w-full text-2xl font-bold tracking-tight text-frost sm:hidden">Good morning, {user?.name}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-frost-soft">
          <CalendarDays className="h-4 w-4 text-brand-cyan" aria-hidden="true" />
          This week
          <span className="font-medium text-frost-muted">{currentWeekRange()}</span>
        </p>
        <Button variant="primary" icon={Plus} onClick={() => navigate('/sales')}>
          New Sale
        </Button>
      </div>

      <section aria-label="Business summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Revenue" value={taka(finance.revenue)} icon={Wallet} glow="cyan" delta={revenueChange} spark={revenue} />
        <MetricCard label="Total Expense" value={taka(finance.expense)} icon={TrendingDown} glow="orange" upIsGood={false} delta={expenseChange} spark={expense} />
        <MetricCard label="Net Profit" value={taka(derived.netProfit)} icon={TrendingUp} glow="emerald" delta={netProfitChange} spark={profitSpark} />
        <MetricCard label="Business Capital" value={taka(finance.capital)} icon={Landmark} glow="indigo" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <RevenueChart />
        <ProfitLossCard />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <InventoryOverview />
        <TopProducts />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <RecentTransactions />
        <SmartAlerts />
      </section>
    </>
  )
}
