'use client'

import Sidebar from '../components/Sidebar'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      <div className="ml-64">
        {/* Top bar */}
        <header className="px-10 pt-10 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-white/60 mt-1">
              Morning Flow snapshot — clean signal, no noise.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition">
              Notifications
            </button>
            <a
              href="/post-deal"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition"
            >
              Post a Deal
            </a>
          </div>
        </header>

        {/* Main content */}
        <main className="px-10 pb-12">
          {/* KPI Row */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KPI title="Today" value="0" sub="Deals submitted" />
            <KPI title="This Week" value="0" sub="Deals submitted" />
            <KPI title="This Month" value="0" sub="Deals submitted" />
          </section>

          {/* Secondary Row */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Trend */}
            <div className="lg:col-span-2 glass p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Flow Trend</h2>
                <span className="text-xs text-white/60">Last 7 days</span>
              </div>

              <div className="h-56 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                Stock-style chart (next)
              </div>

              <div className="grid grid-cols-3 gap-4 mt-5">
                <MiniStat label="Team Total" value="$0" />
                <MiniStat label="Writing Agents" value="0" />
                <MiniStat label="Top Carrier" value="—" />
              </div>
            </div>

            {/* Leaderboard */}
            <div className="glass p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Leaderboard</h2>
                <span className="text-xs text-white/60">This week</span>
              </div>

              <div className="space-y-3">
                <Leader rank={1} name="Top Agent" amount="$0" highlight />
                <Leader rank={2} name="Agent" amount="$0" />
                <Leader rank={3} name="Agent" amount="$0" />
                <Leader rank={4} name="Agent" amount="$0" />
                <Leader rank={5} name="Agent" amount="$0" />
              </div>

              <div className="mt-6 text-xs text-white/50">
                Top 3 will display with premium styling once live data is wired.
              </div>
            </div>
          </section>

          {/* Activity */}
          <section className="mt-6 glass p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Recent Activity</h2>
              <span className="text-xs text-white/60">Latest submissions</span>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <Row head left="Agent" mid="Carrier" right="Premium" />
              <Row left="—" mid="—" right="—" />
              <Row left="—" mid="—" right="—" />
              <Row left="—" mid="—" right="—" />
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

function KPI({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="glass p-6">
      <p className="text-sm text-white/60">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight">{value}</span>
        <span className="text-sm text-white/50">{sub}</span>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-white/60">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  )
}

function Leader({
  rank,
  name,
  amount,
  highlight,
}: {
  rank: number
  name: string
  amount: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 ${
        highlight ? 'bg-white/10' : 'bg-white/5'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
            highlight ? 'bg-blue-600' : 'bg-white/10'
          }`}
        >
          {rank}
        </div>
        <div>
          <div className={`${highlight ? 'text-base font-semibold' : 'text-sm font-medium'}`}>
            {name}
          </div>
          <div className="text-xs text-white/50">Weekly production</div>
        </div>
      </div>

      <div className={`${highlight ? 'text-lg font-semibold' : 'text-sm font-semibold'} text-green-400`}>
        {amount}
      </div>
    </div>
  )
}

function Row({
  head,
  left,
  mid,
  right,
}: {
  head?: boolean
  left: string
  mid: string
  right: string
}) {
  return (
    <div
      className={`grid grid-cols-3 px-4 py-3 border-b border-white/10 ${
        head ? 'text-xs text-white/60 bg-white/5' : 'text-sm'
      }`}
    >
      <div>{left}</div>
      <div className="text-center">{mid}</div>
      <div className="text-right">{right}</div>
    </div>
  )
}
