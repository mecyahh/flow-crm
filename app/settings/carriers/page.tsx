// app/settings/carriers/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  role: string | null
  is_agency_owner: boolean | null
}

type CarrierRow = {
  id: string
  created_at: string
  custom_name: string | null
  supported_name: string | null
  advance_rate: number | null
  active: boolean | null
}

type ProductRow = {
  id: string
  carrier_id: string
}

const SUPPORTED = [
  'Aetna',
  'Aflac',
  'Royal Neighbors of America',
  'SBLI',
  'Transamerica',
] as const

export default function CarriersSettingsPage() {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)
  const [me, setMe] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [carriers, setCarriers] = useState<CarrierRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])

  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState({
    custom_name: '',
    supported_name: 'Aetna',
    advance_rate: '0.75',
    active: true,
  })

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setLoading(true)

    const { data: ures, error: uerr } = await supabase.auth.getUser()
    if (uerr) {
      setToast(`auth.getUser: ${uerr.message}`)
      setLoading(false)
      return
    }
    const uid = ures.user?.id
    if (!uid) {
      window.location.href = '/login'
      return
    }

    const { data: prof, error: perr } = await supabase
      .from('profiles')
      .select('id, role, is_agency_owner')
      .eq('id', uid)
      .single()

    if (perr || !prof) {
      setToast('Could not load profile')
      setLoading(false)
      return
    }

    const p = prof as Profile
    setMe(p)

    if ((p.role || '').toLowerCase() !== 'admin') {
      setToast('Locked: Admins only')
      setLoading(false)
      return
    }

    await loadAll()
    setLoading(false)
  }

  async function loadAll() {
    const { data: cdata, error: cerr } = await supabase
      .from('carriers')
      .select('id, created_at, custom_name, supported_name, advance_rate, active')
      .order('custom_name', { ascending: true })
      .limit(5000)

    if (cerr) {
      setToast('Could not load carriers (RLS?)')
      setCarriers([])
    } else {
      setCarriers((cdata || []) as CarrierRow[])
    }

    const { data: pdata, error: perr } = await supabase
      .from('carrier_products')
      .select('id, carrier_id')
      .limit(5000)

    if (!perr) setProducts((pdata || []) as ProductRow[])
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return carriers
    return carriers.filter((c) => {
      const blob = `${c.custom_name || ''} ${c.supported_name || ''}`.toLowerCase()
      return blob.includes(q)
    })
  }, [carriers, search])

  const productCountByCarrier = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) m.set(p.carrier_id, (m.get(p.carrier_id) || 0) + 1)
    return m
  }, [products])

  async function createCarrier() {
    if (!me) return
    if ((me.role || '').toLowerCase() !== 'admin') return setToast('Locked: Admins only')

    const payload = {
      custom_name: draft.custom_name.trim() || null,
      supported_name: draft.supported_name || null,
      advance_rate: toNum(draft.advance_rate),
      active: !!draft.active,
    }

    const { error } = await supabase.from('carriers').insert(payload)
    if (error) {
      setToast('Create failed (RLS?)')
      return
    }

    setToast('Carrier created ✅')
    setCreateOpen(false)
    setDraft({ custom_name: '', supported_name: 'Aetna', advance_rate: '0.75', active: true })
    loadAll()
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-white/10 shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3 flex gap-2">
              <button className={btnSoft} onClick={() => setToast(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ml-64 px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Settings · Carriers</h1>
            <p className="text-sm text-white/60 mt-1">Admin-only carrier + product comp setup.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="glass rounded-2xl border border-white/10 px-3 py-2 flex items-center gap-2">
              <input
                className="bg-transparent outline-none text-sm w-72 placeholder:text-white/40"
                placeholder="Search carriers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button onClick={() => setCreateOpen(true)} className={btnPink}>
              Create Carrier
            </button>
            <button onClick={() => setCreateOpen(true)} className={btnPink}>
              Create Carrier
            </button>

            <button onClick={loadAll} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
            <div className="text-sm font-semibold">Carriers</div>
            <div className="text-xs text-white/60">{filtered.length.toLocaleString()} total</div>
          </div>

          {loading && <div className="px-6 py-10 text-center text-white/60">Loading…</div>}

          {!loading && filtered.length === 0 && (
            <div className="px-6 py-10 text-center text-white/60">No carriers yet.</div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-white/55">
                  <tr className="border-b border-white/10">
                    <th className={th}>Name</th>
                    <th className={th}>Supported Name</th>
                    <th className={thCenter}>Policies Sold</th>
                    <th className={thCenter}>Products</th>
                    <th className={thCenter}>Advance Rate</th>
                    <th className={thRight}></th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((c) => {
                    const prodCount = productCountByCarrier.get(c.id) || 0
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-white/10 hover:bg-white/5 transition cursor-pointer"
                        onClick={() => router.push(`/settings/carriers/${c.id}`)}
                      >
                        <td className={tdStrong}>{c.custom_name || '—'}</td>
                        <td className={td}>{c.supported_name || '—'}</td>
                        <td className={tdCenter}>—</td>
                        <td className={tdCenter}>{prodCount}</td>
                        <td className={tdCenter}>{c.advance_rate ?? 0.75}</td>
                        <td className={tdRight}>
                          <button className={miniBtn} onClick={(e) => (e.stopPropagation(), router.push(`/settings/carriers/${c.id}`))}>
                            Open →
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="glass rounded-2xl border border-white/10 p-6 w-full max-w-3xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Add a Carrier</div>
                <div className="text-xs text-white/55 mt-1">Custom name + supported mapping.</div>
              </div>

              <button onClick={() => setCreateOpen(false)} className={closeBtn}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Custom name">
                <input
                  className={inputCls}
                  value={draft.custom_name}
                  onChange={(e) => setDraft((p) => ({ ...p, custom_name: e.target.value }))}
                  placeholder="American Amicable"
                />
              </Field>

              <Field label="Supported name">
                <select
                  className={inputCls}
                  value={draft.supported_name}
                  onChange={(e) => setDraft((p) => ({ ...p, supported_name: e.target.value }))}
                >
                  {SUPPORTED.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Advance rate">
                <input
                  className={inputCls}
                  value={draft.advance_rate}
                  onChange={(e) => setDraft((p) => ({ ...p, advance_rate: e.target.value }))}
                  placeholder="0.75"
                />
              </Field>

              <Field label="Active">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))}
                    className="h-5 w-5"
                  />
                  <div className="text-sm">Carrier is active</div>
                </div>
              </Field>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setCreateOpen(false)} className={closeBtn}>
                Cancel
              </button>
              <button onClick={createCarrier} className={btnPink}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function toNum(v: any) {
  if (v === null || v === undefined || v === '') return null
  const num = Number(String(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(num) ? num : null
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'
const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
const closeBtn =
  'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold'
const btnPink =
  'rounded-2xl bg-fuchsia-600 hover:bg-fuchsia-500 transition px-5 py-3 text-sm font-semibold'

const th = 'text-left px-6 py-3 whitespace-nowrap'
const thCenter = 'text-center px-6 py-3 whitespace-nowrap'
const thRight = 'text-right px-6 py-3 whitespace-nowrap'

const td = 'px-6 py-4 text-white/80 whitespace-nowrap'
const tdStrong = 'px-6 py-4 font-semibold whitespace-nowrap'
const tdCenter = 'px-6 py-4 text-center whitespace-nowrap'
const tdRight = 'px-6 py-4 text-right whitespace-nowrap'

const miniBtn =
  'rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs'
