// ✅ REPLACE ENTIRE FILE: /app/settings/carriers/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  role: string
  is_agency_owner: boolean
}

type CarrierRow = {
  id: string
  created_at: string
  name: string
  supported_name: string | null
  advance_rate: number | null
  active: boolean | null
  sort_order: number | null
  logo_url: string | null
  eapp_url: string | null
  portal_url: string | null
  support_phone: string | null
}

const SUPPORTED_NAMES = [
  'Aetna',
  'Aflac',
  'Royal Neighbors of America',
  'SBLI',
  'Transamerica',
  'American Amicable',
  'Mutual of Omaha',
] as const

export default function CarriersSettingsPage() {
  const [toast, setToast] = useState<string | null>(null)
  const [me, setMe] = useState<Profile | null>(null)

  const [loading, setLoading] = useState(false)
  const [carriers, setCarriers] = useState<CarrierRow[]>([])
  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    supported_name: 'Aetna',
    advance_rate: '0.75',
    active: true,
    sort_order: '0',
    logo_url: '',
    eapp_url: '',
    portal_url: '',
    support_phone: '',
  })

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) {
      window.location.href = '/login'
      return
    }

    const { data: prof } = await supabase.from('profiles').select('id,role,is_agency_owner').eq('id', uid).single()
    if (!prof) return

    setMe(prof as Profile)

    // admin-only access
    if ((prof as Profile).role !== 'admin') {
      window.location.href = '/settings'
      return
    }

    await loadCarriers()
  }

  async function loadCarriers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('carriers')
      .select('id,created_at,name,active,sort_order,logo_url,eapp_url,portal_url,support_phone,supported_name,advance_rate')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) setToast(`Could not load carriers: ${error.message}`)
    setCarriers((data || []) as CarrierRow[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return carriers
    return carriers.filter((c) =>
      [c.name, c.supported_name || ''].join(' ').toLowerCase().includes(q)
    )
  }, [carriers, search])

  async function createCarrier() {
    const name = form.name.trim()
    if (!name) return setToast('Carrier name required')

    const adv = Number(form.advance_rate)
    if (!Number.isFinite(adv) || adv <= 0) return setToast('Advance rate invalid (ex: 0.75)')

    const sort = Number(form.sort_order)
    const sort_order = Number.isFinite(sort) ? sort : 0

    const payload: any = {
      name,
      supported_name: form.supported_name || null,
      advance_rate: adv,
      active: !!form.active,
      sort_order,
      logo_url: form.logo_url.trim() || null,
      eapp_url: form.eapp_url.trim() || null,
      portal_url: form.portal_url.trim() || null,
      support_phone: form.support_phone.trim() || null,
    }

    const { error } = await supabase.from('carriers').insert(payload)
    if (error) return setToast(`Create failed: ${error.message}`)

    setToast('Carrier created ✅')
    setCreateOpen(false)
    setForm({
      name: '',
      supported_name: 'Aetna',
      advance_rate: '0.75',
      active: true,
      sort_order: '0',
      logo_url: '',
      eapp_url: '',
      portal_url: '',
      support_phone: '',
    })
    await loadCarriers()
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-[var(--border)] shadow-2xl">
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
            <h1 className="text-3xl font-semibold tracking-tight">Carriers</h1>
            <p className="text-sm text-[var(--text)]/60 mt-1">Admin-only carrier directory + configuration.</p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setCreateOpen(true)} className={saveBtn}>
              Create Carrier
            </button>
            <button onClick={loadCarriers} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl border border-[var(--border)] px-3 py-2 flex items-center gap-2 mb-4">
          <input
            className="bg-transparent outline-none text-sm w-full placeholder:text-[var(--text)]/40"
            placeholder="Search carriers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 border-b border-[var(--border)] text-[11px] text-[var(--text)]/60 bg-[var(--panel)]">
            <div className="col-span-4">Carrier</div>
            <div className="col-span-3">Supported Name</div>
            <div className="col-span-2 text-center">Advance Rate</div>
            <div className="col-span-1 text-center">Active</div>
            <div className="col-span-2 text-right">Open</div>
          </div>

          {loading && <div className="px-4 py-6 text-sm text-[var(--text)]/60">Loading…</div>}

          {!loading &&
            filtered.map((c) => (
              <div key={c.id} className="grid grid-cols-12 px-4 py-3 border-b border-[var(--border)] text-sm items-center">
                <div className="col-span-4 font-semibold">{c.name}</div>
                <div className="col-span-3 text-[var(--text)]/75">{c.supported_name || '—'}</div>
                <div className="col-span-2 text-center text-[var(--text)]/80">
                  {typeof c.advance_rate === 'number' ? c.advance_rate.toFixed(2) : '—'}
                </div>
                <div className="col-span-1 text-center">{c.active ? '✅' : '—'}</div>
                <div className="col-span-2 text-right">
                  <button
                    className="rounded-xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-3 py-2 text-xs"
                    onClick={() => (window.location.href = `/settings/carriers/${c.id}`)}
                  >
                    Manage →
                  </button>
                </div>
              </div>
            ))}

          {!loading && filtered.length === 0 && <div className="px-4 py-6 text-sm text-[var(--text)]/60">No carriers.</div>}
        </div>
      </div>

      {/* CREATE MODAL */}
      {createOpen && (
        <div className="fixed inset-0 bg-[var(--bg)]/60 flex items-center justify-center z-50 p-6">
          <div className="glass rounded-2xl border border-[var(--border)] p-6 w-full max-w-3xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Add a Carrier</div>
                <div className="text-xs text-[var(--text)]/55 mt-1">Admin-only.</div>
              </div>
              <button onClick={() => setCreateOpen(false)} className={closeBtn}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Carrier name (display)">
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Royal Neighbors"
                />
              </Field>

              <Field label="Supported name">
                <select
                  className={inputCls}
                  value={form.supported_name}
                  onChange={(e) => setForm((p) => ({ ...p, supported_name: e.target.value }))}
                >
                  {SUPPORTED_NAMES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Advance rate (ex: 0.75)">
                <input
                  className={inputCls}
                  value={form.advance_rate}
                  onChange={(e) => setForm((p) => ({ ...p, advance_rate: e.target.value }))}
                />
              </Field>

              <Field label="Sort order">
                <input
                  className={inputCls}
                  value={form.sort_order}
                  onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
                  placeholder="0"
                />
              </Field>

              <Field label="Support phone">
                <input
                  className={inputCls}
                  value={form.support_phone}
                  onChange={(e) => setForm((p) => ({ ...p, support_phone: e.target.value }))}
                  placeholder="(888) 888-8888"
                />
              </Field>

              <Field label="Logo URL (optional)">
                <input
                  className={inputCls}
                  value={form.logo_url}
                  onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
                  placeholder="https://..."
                />
              </Field>

              <Field label="eApp URL (optional)">
                <input
                  className={inputCls}
                  value={form.eapp_url}
                  onChange={(e) => setForm((p) => ({ ...p, eapp_url: e.target.value }))}
                  placeholder="https://..."
                />
              </Field>

              <Field label="Portal URL (optional)">
                <input
                  className={inputCls}
                  value={form.portal_url}
                  onChange={(e) => setForm((p) => ({ ...p, portal_url: e.target.value }))}
                  placeholder="https://..."
                />
              </Field>

              <Field label="Active">
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
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
              <button onClick={createCarrier} className={saveBtn}>
                Create Carrier
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
      <div className="text-[11px] text-[var(--text)]/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
        active ? 'bg-[var(--panel2)] border-white/15' : 'bg-[var(--panel)] border-[var(--border)] hover:bg-[var(--panel2)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

const inputCls =
  'w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnSoft = 'rounded-xl bg-[var(--panel2)] hover:bg-white/15 transition px-3 py-2 text-xs'
const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-[var(--panel2)] transition rounded-2xl border border-[var(--border)]'

const closeBtn =
  'rounded-2xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-4 py-3 text-sm font-semibold'

const saveBtn =
  'rounded-2xl bg-green-600 hover:bg-green-500 transition px-5 py-3 text-sm font-semibold'
