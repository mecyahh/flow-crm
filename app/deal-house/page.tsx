'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Deal = {
  id: string
  full_name: string | null
  company: string | null
  policy_number: string | null
  coverage: number | null
  premium: number | null
  client_dob: string | null
  beneficiary: string | null
  notes: string | null
  status?: string | null
  created_at: string
}

const FILTERS = ['All', 'Active', 'Pending', 'Submitted', 'Chargeback'] as const

export default function DealHousePage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDeals()
  }, [])

  async function loadDeals() {
    setLoading(true)

    const { data, error } = await supabase
      .from('deals')
      .select(
        'id, full_name, company, policy_number, coverage, premium, client_dob, beneficiary, notes, status, created_at'
      )
      .order('created_at', { ascending: false })

    if (!error && data) setDeals(data as Deal[])
    setLoading(false)
  }

  const visibleDeals = useMemo(() => {
    if (filter === 'All') return deals
    return deals.filter((d) => d.status === filter)
  }, [deals, filter])

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      <div className="ml-64 px-10 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Deal House</h1>
            <p className="text-sm text-white/60 mt-1">
              Clean book of business. Fast scan.
            </p>
          </div>

          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm transition ${
                  filter === f ? 'bg-blue-600' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl overflow-hidden border border-white/10">
          {/* Header */}
          <div className="grid grid-cols-10 gap-3 px-6 py-4 text-[11px] text-white/60 bg-white/5">
            <div className="col-span-2">Full Name</div>
            <div className="col-span-2">Company</div>
            <div className="col-span-1">Policy #</div>
            <div className="col-span-1 text-right">Coverage</div>
            <div className="col-span-1 text-right">Premium</div>
            <div className="col-span-1">DOB</div>
            <div className="col-span-2">Beneficiary</div>
          </div>

          {loading && (
            <div className="px-6 py-10 text-center text-white/60">
              Loading deals…
            </div>
          )}

          {!loading && visibleDeals.length === 0 && (
            <div className="px-6 py-10 text-center text-white/60">
              No deals found.
            </div>
          )}

          {!loading &&
            visibleDeals.map((d) => (
              <div
                key={d.id}
                className="border-t border-white/10 hover:bg-white/5 transition"
              >
                <div className="grid grid-cols-10 gap-3 px-6 py-4">
                  <div className="col-span-2 font-medium truncate">
                    {d.full_name || '—'}
                  </div>

                  <div className="col-span-2 text-white/70 truncate">
                    {d.company || '—'}
                  </div>

                  <div className="col-span-1 text-white/70 truncate">
                    {d.policy_number || '—'}
                  </div>

                  <div className="col-span-1 text-right font-semibold">
                    {d.coverage ? `$${formatMoney(d.coverage)}` : '—'}
                  </div>

                  <div className="col-span-1 text-right font-semibold">
                    {d.premium ? `$${formatMoney(d.premium)}` : '—'}
                  </div>

                  <div className="col-span-1 text-white/70">
                    {d.client_dob ? prettyDate(d.client_dob) : '—'}
                  </div>

                  <div className="col-span-2 text-white/70 truncate">
                    {d.beneficiary || '—'}
                  </div>
                </div>

                {/* Notes */}
                <div className="px-6 pb-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
                    <span className="text-white/50 mr-2">Note:</span>
                    {d.notes?.trim() ? d.notes : '—'}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function formatMoney(n: number) {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function prettyDate(isoOrDate: string) {
  const d = new Date(isoOrDate)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}
