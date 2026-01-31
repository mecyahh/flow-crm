// ✅ FILE: /app/deal-house/page.tsx  (REPLACE ENTIRE FILE)
// Fixes "Loading…" (robust load + always ends loading)
// Adds Personal/Team tabs (Personal = yellow, Team = fuchsia)
// Team tab = uplines inherit ALL downlines deals (recursive tree)
// ✅ Adds Notifications tab (PERSONAL book-of-business only) + chime + always-on alerts
// ✅ Replaces ✏️ / 📁 with glass icons (no behavior changes)

'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import GlassSelect from '@/app/components/GlassSelect'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  is_agency_owner: boolean | null
  upline_id: string | null
  avatar_url?: string | null
}

type Deal = {
  id: string
  created_at: string
  agent_id: string
  full_name: string | null
  phone: string | null
  dob: string | null
  company: string | null
  policy_number: string | null
  coverage: number | null
  premium: number | null
  status: string | null
  note: string | null
  notes: string | null

  street_address: string | null
  social: string | null
  routing_number: string | null
  account_number: string | null
}

const STATUS = [
  { v: 'pending', label: 'Pending' },
  { v: 'active', label: 'Active' },
  { v: 'chargeback', label: 'Chargeback' },
  { v: 'potential_lapse', label: 'Potential Lapse' },
  { v: 'lapsed', label: 'Lapsed' },
  { v: 'premium_returned', label: 'Premium Returned' },
] as const

type Tab = 'personal' | 'team' | 'notifications'

type BoboNotif = {
  id: string
  deal_id: string
  client: string
  dueAt: Date
  label: string
  body: string
  stage: '24h' | '3d' | '7d' | '30d'
  done?: boolean
}

export default function DealHousePage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [me, setMe] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [rows, setRows] = useState<Deal[]>([])
  const [search, setSearch] = useState('')

  const [tab, setTab] = useState<Tab>('personal')

  const [editing, setEditing] = useState<Deal | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [folderDeal, setFolderDeal] = useState<Deal | null>(null)

  // ✅ Chime: always-on (best-effort — browsers may require first user gesture)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const chimeArmedRef = useRef(false)

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setLoading(true)
    setToast(null)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw new Error(`auth.getUser: ${userErr.message}`)
      const uid = userRes.user?.id
      if (!uid) {
        window.location.href = '/login'
        return
      }

      const { data: myProf, error: myProfErr } = await supabase
        .from('profiles')
        .select('id,email,first_name,last_name,role,is_agency_owner,upline_id,avatar_url')
        .eq('id', uid)
        .single()

      if (myProfErr || !myProf) throw new Error('Could not load profile')

      const my = myProf as Profile
      setMe(my)

      // Load all profiles (needed to compute downline tree)
      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('id,email,first_name,last_name,role,is_agency_owner,upline_id,avatar_url')
        .limit(10000)

      if (profErr) throw new Error('Could not load profiles')

      const list = (profs || []) as Profile[]
      setProfiles(list)

      // Default tab:
      // - agents start on personal
      // - owners/admins start on team
      const isOwner = !!my.is_agency_owner || (my.role || '').toLowerCase() === 'admin'
      setTab(isOwner ? 'team' : 'personal')

      setLoading(false)
    } catch (e: any) {
      setToast(e?.message || 'Boot failed')
      setLoading(false)
    }
  }

  // Build downline closure (recursive)
  const downlineIds = useMemo(() => {
    if (!me) return []
    const childrenByUpline = new Map<string, string[]>()
    for (const p of profiles) {
      if (!p.upline_id) continue
      if (!childrenByUpline.has(p.upline_id)) childrenByUpline.set(p.upline_id, [])
      childrenByUpline.get(p.upline_id)!.push(p.id)
    }

    const out: string[] = []
    const q: string[] = [me.id]
    const seen = new Set<string>([me.id])

    while (q.length) {
      const cur = q.shift()!
      const kids = childrenByUpline.get(cur) || []
      for (const kid of kids) {
        if (seen.has(kid)) continue
        seen.add(kid)
        out.push(kid)
        q.push(kid)
      }
    }
    return out
  }, [me, profiles])

  const canSeeTeam = useMemo(() => {
    if (!me) return false
    const role = (me.role || '').toLowerCase()
    return !!me.is_agency_owner || role === 'admin' || downlineIds.length > 0
  }, [me, downlineIds.length])

  const teamAgentIds = useMemo(() => {
    if (!me) return []
    return [me.id, ...downlineIds]
  }, [me, downlineIds])

  useEffect(() => {
    if (!me) return
    loadDeals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, tab, profiles.length])

  async function loadDeals() {
    setLoading(true)
    setToast(null)

    try {
      if (!me) return

      // ✅ Notifications tab is PERSONAL only; still load personal deals so notifications can compute
      const ids = tab === 'team' && canSeeTeam ? teamAgentIds : [me.id]

      // if team tab selected but not allowed, fall back
      if (tab === 'team' && !canSeeTeam) {
        setTab('personal')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('deals')
        .select(
          'id, created_at, agent_id, full_name, phone, dob, company, policy_number, coverage, premium, status, note, notes, street_address, social, routing_number, account_number'
        )
        .in('agent_id', ids)
        .order('created_at', { ascending: false })
        .limit(3000)

      if (error) throw new Error('Could not load Deal House (RLS)')

      setRows((data || []) as Deal[])
      setLoading(false)
    } catch (e: any) {
      setRows([])
      setToast(e?.message || 'Load failed')
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((d) => {
      const blob = [
        d.full_name,
        d.phone,
        d.company,
        d.policy_number,
        d.status,
        d.dob,
        agentName(d.agent_id, profiles),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [rows, search, profiles])

  async function saveEdit() {
    if (!editing) return

    const payload = {
      full_name: editing.full_name?.trim() || null,
      phone: cleanPhone(editing.phone || ''),
      dob: editing.dob || null,
      company: editing.company?.trim() || null,
      policy_number: editing.policy_number?.trim() || null,
      coverage: toNum(editing.coverage),
      premium: toNum(editing.premium),
      status: (editing.status || 'pending').toLowerCase(),
      note: editing.note || null,
      notes: editing.notes || null,
    }

    const { error } = await supabase.from('deals').update(payload).eq('id', editing.id)
    if (error) return setToast('Save failed')

    setEditing(null)
    setShowNotes(false)
    setToast('Saved ✅')
    loadDeals()
  }

  async function saveFolder() {
    if (!folderDeal) return

    const payload = {
      street_address: folderDeal.street_address?.trim() || null,
      social: folderDeal.social?.trim() || null,
      routing_number: (folderDeal.routing_number || '').replace(/\s/g, '') || null,
      account_number: (folderDeal.account_number || '').replace(/\s/g, '') || null,
      note: folderDeal.note || null,
      notes: folderDeal.notes || null,
    }

    const { error } = await supabase.from('deals').update(payload).eq('id', folderDeal.id)
    if (error) return setToast('Save failed')

    setFolderDeal(null)
    setToast('Saved ✅')
    loadDeals()
  }

  // ✅ PERSONAL book-of-business notifications (NOT team)
  const personalRows = useMemo(() => {
    if (!me) return []
    return rows.filter((r) => r.agent_id === me.id)
  }, [rows, me])

  const boboNotifs = useMemo(() => {
    return buildBoboNotifs(personalRows)
  }, [personalRows])

  const dueNotifs = useMemo(() => {
    const now = Date.now()
    return boboNotifs.filter((n) => n.dueAt.getTime() <= now)
  }, [boboNotifs])

  const notifBadge = dueNotifs.length

  // ✅ Arm audio context on first user gesture, then we can chime whenever.
  useEffect(() => {
    function arm() {
      if (chimeArmedRef.current) return
      try {
        const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext
        if (!Ctx) return
        audioCtxRef.current = new Ctx()
        // resume best-effort
        audioCtxRef.current.resume?.().catch(() => {})
        chimeArmedRef.current = true
      } catch {}
    }
    window.addEventListener('pointerdown', arm, { once: true })
    return () => window.removeEventListener('pointerdown', arm as any)
  }, [])

  // ✅ Chime whenever a NEW due notification appears (once per notification id)
  useEffect(() => {
    if (!dueNotifs.length) return
    const seen = readSeenMap()
    const toPlay = dueNotifs.find((n) => !seen[n.id])
    if (!toPlay) return

    // mark as seen immediately (so it doesn't loop)
    seen[toPlay.id] = Date.now()
    writeSeenMap(seen)

    playChime()
  }, [dueNotifs.length])

  function playChime() {
    try {
      const ctx = audioCtxRef.current
      if (!ctx) return
      const now = ctx.currentTime

      const master = ctx.createGain()
      master.gain.value = 0.09
      master.connect(ctx.destination)

      const freqs = [880, 1174, 1568] // A5, D6-ish, G6-ish (nice chime)
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.setValueAtTime(f, now)
        g.gain.setValueAtTime(0.0, now)
        g.gain.linearRampToValueAtTime(1.0, now + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55 + i * 0.06)
        o.connect(g)
        g.connect(master)
        o.start(now + i * 0.02)
        o.stop(now + 0.7 + i * 0.06)
      })
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">

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

      <div className="w-full min-w-0 px-4 py-6 md:px-10 md:py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Deal House</h1>
            <p className="text-sm text-white/60 mt-1">
              {tab === 'team'
                ? 'Team view'
                : tab === 'notifications'
                ? 'Notifications (your book of business)'
                : 'Personal view'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs (top right) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTab('personal')}
                className={[
                  'rounded-2xl px-4 py-2 text-sm font-semibold border transition',
                  tab === 'personal'
                    ? 'bg-yellow-500/20 border-yellow-400/35 text-yellow-100'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80',
                ].join(' ')}
              >
                Personal
              </button>

              <button
                onClick={() => setTab('team')}
                disabled={!canSeeTeam}
                className={[
                  'rounded-2xl px-4 py-2 text-sm font-semibold border transition',
                  tab === 'team'
                    ? 'bg-fuchsia-500/20 border-fuchsia-400/35 text-fuchsia-100'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white/80',
                  !canSeeTeam ? 'opacity-40 cursor-not-allowed hover:bg-white/5' : '',
                ].join(' ')}
                title={!canSeeTeam ? 'No downlines assigned yet' : 'Team'}
              >
                Team
              </button>

              {/* ✅ Notifications tab (personal only) */}
              <button
                onClick={() => setTab('notifications')}
                className={[
                  'rounded-2xl px-4 py-2 text-sm font-semibold border transition inline-flex items-center gap-2',
                  tab === 'notifications'
                    ? 'bg-blue-500/20 border-blue-400/35 text-blue-100'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80',
                ].join(' ')}
                title="Book of Business notifications (personal only)"
              >
                <BellIcon />
                Notifications
                {notifBadge > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-500/80 text-white text-[11px] font-bold">
                    {notifBadge}
                  </span>
                )}
              </button>
            </div>

            <div className="glass rounded-2xl border border-white/10 px-3 py-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm6.5 1 4-4"
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <input
                className="bg-transparent outline-none text-sm w-72 placeholder:text-white/40"
                placeholder={tab === 'notifications' ? 'Search notifications…' : 'Search…'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button onClick={loadDeals} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        {/* ✅ Notifications view */}
        {tab === 'notifications' && (
          <div className="glass rounded-2xl border border-white/10 overflow-hidden mb-6">
            <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
              <div className="text-sm font-semibold">Book of Business Alerts</div>
              <div className="text-xs text-white/60">
                {loading ? 'Loading…' : `${boboNotifs.length.toLocaleString()} scheduled • ${dueNotifs.length.toLocaleString()} due`}
              </div>
            </div>

            {loading && <div className="px-6 py-10 text-center text-white/60">Loading…</div>}

            {!loading && boboNotifs.length === 0 && (
              <div className="px-6 py-10 text-center text-white/60">
                No alerts yet. Alerts generate automatically from your <span className="text-white/80 font-semibold">ACTIVE</span> deals.
              </div>
            )}

            {!loading && boboNotifs.length > 0 && (
              <div className="divide-y divide-white/10">
                {filterNotifsForSearch(boboNotifs, search).map((n) => {
                  const isDue = n.dueAt.getTime() <= Date.now()
                  return (
                    <div key={n.id} className="px-6 py-4 hover:bg-white/5 transition flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              'text-[11px] px-2 py-1 rounded-xl border font-semibold',
                              isDue
                                ? 'bg-red-500/12 border-red-400/25 text-red-200'
                                : 'bg-white/6 border-white/12 text-white/70',
                            ].join(' ')}
                          >
                            {isDue ? 'DUE' : 'UPCOMING'}
                          </span>

                          <span className="text-sm font-semibold truncate">{n.label}</span>
                        </div>

                        <div className="text-xs text-white/60 mt-2">{n.body}</div>
                        <div className="text-[11px] text-white/45 mt-2">
                          Due: {n.dueAt.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-xs text-white/60">Client</div>
                        <div className="text-sm font-semibold">{n.client}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ✅ Deals table view (unchanged behavior) */}
        {tab !== 'notifications' && (
          <div className="glass rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
              <div className="text-sm font-semibold">All Deals</div>
              <div className="text-xs text-white/60">
                {loading ? 'Loading…' : `${filtered.length.toLocaleString()} records`}
              </div>
            </div>

            {loading && <div className="px-6 py-10 text-center text-white/60">Loading…</div>}

            {!loading && filtered.length === 0 && <div className="px-6 py-10 text-center text-white/60">No deals yet.</div>}

            {!loading && filtered.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] text-white/55">
                    <tr className="border-b border-white/10">
                      {tab === 'team' && <th className={th}>Agent</th>}
                      <th className={th}>Name</th>
                      <th className={th}>Phone</th>
                      <th className={th}>DOB</th>
                      <th className={th}>Company</th>
                      <th className={th}>Policy #</th>
                      <th className={th}>Coverage</th>
                      <th className={th}>Premium</th>
                      <th className={th}>Status</th>
                      <th className={thRight}></th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((d) => (
                      <tr key={d.id} className="border-b border-white/10 hover:bg-white/5 transition">
                        {tab === 'team' && <td className={td}>{agentName(d.agent_id, profiles)}</td>}
                        <td className={tdStrong}>{d.full_name || '—'}</td>
                        <td className={td}>{d.phone || '—'}</td>
                        <td className={td}>{d.dob ? prettyDate(d.dob) : '—'}</td>
                        <td className={td}>{d.company || '—'}</td>
                        <td className={td}>{d.policy_number || '—'}</td>
                        <td className={td}>{d.coverage ? `$${fmtMoney(d.coverage)}` : '—'}</td>
                        <td className={td}>{d.premium ? `$${fmtMoney(d.premium)}` : '—'}</td>
                        <td className={td}>
                          <span className={statusPill(d.status)}>{(d.status || 'pending').toUpperCase()}</span>
                        </td>
                        <td className={tdRight}>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditing(d)
                                setShowNotes(false)
                              }}
                              className={iconBtn}
                              title="Edit"
                            >
                              <GlassPencilIcon />
                            </button>

                            <button onClick={() => setFolderDeal(d)} className={iconBtn} title="Folder">
                              <GlassFolderIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 text-[11px] text-white/45">Ensure to Follow Up With Your Clients</div>
      </div>

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="glass rounded-2xl border border-white/10 p-6 w-full max-w-3xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Edit Deal</div>
                <div className="text-xs text-white/55 mt-1">Updates save instantly to Deal House.</div>
              </div>

              <button
                onClick={() => {
                  setEditing(null)
                  setShowNotes(false)
                }}
                className={closeBtn}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input
                  className={inputCls}
                  value={editing.full_name || ''}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </Field>

              <Field label="Phone Number">
                <input
                  className={inputCls}
                  value={editing.phone || ''}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  placeholder="(888) 888-8888"
                />
              </Field>

              <Field label="DOB">
                <FlowDatePicker value={editing.dob || ''} onChange={(v) => setEditing({ ...editing, dob: v })} placeholder="Select DOB" />
              </Field>

              <Field label="Company">
                <input className={inputCls} value={editing.company || ''} onChange={(e) => setEditing({ ...editing, company: e.target.value })} />
              </Field>

              <Field label="Policy #">
                <input
                  className={inputCls}
                  value={editing.policy_number || ''}
                  onChange={(e) => setEditing({ ...editing, policy_number: e.target.value })}
                />
              </Field>

              <Field label="Status">
  <GlassSelect
    value={(editing.status || 'pending').toLowerCase()}
    onChange={(v) => setEditing({ ...editing, status: v })}
    options={STATUS.map((s) => ({ value: s.v, label: s.label }))}
  />
</Field>

              <Field label="Coverage">
                <input
                  className={inputCls}
                  value={editing.coverage ?? ''}
                  onChange={(e) => setEditing({ ...editing, coverage: toNum(e.target.value) })}
                  placeholder="100000"
                />
              </Field>

              <Field label="Premium">
                <input
                  className={inputCls}
                  value={editing.premium ?? ''}
                  onChange={(e) => setEditing({ ...editing, premium: toNum(e.target.value) })}
                  placeholder="100"
                />
              </Field>
            </div>

            <div className="mt-5">
              <button
                onClick={() => setShowNotes((s) => !s)}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold w-full flex items-center justify-between"
              >
                <span>Notes</span>
                <span className="text-white/60">{showNotes ? 'Hide' : 'Show'}</span>
              </button>

              {showNotes && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <textarea
                    className={`${inputCls} min-h-[110px]`}
                    value={editing.note || editing.notes || ''}
                    onChange={(e) => setEditing({ ...editing, note: e.target.value, notes: e.target.value })}
                    placeholder="Notes…"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setEditing(null)
                  setShowNotes(false)
                }}
                className={closeBtn}
              >
                Cancel
              </button>

              <button onClick={saveEdit} className={saveBtn}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOLDER MODAL */}
      {folderDeal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="glass rounded-2xl border border-white/10 p-6 w-full max-w-3xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Folder</div>
                <div className="text-xs text-white/55 mt-1">Extra fields (address, banking, notes).</div>
              </div>

              <button onClick={() => setFolderDeal(null)} className={closeBtn}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Street Address">
                <input
                  className={inputCls}
                  value={folderDeal.street_address || ''}
                  onChange={(e) => setFolderDeal({ ...folderDeal, street_address: e.target.value })}
                />
              </Field>

              <Field label="Social">
                <input className={inputCls} value={folderDeal.social || ''} onChange={(e) => setFolderDeal({ ...folderDeal, social: e.target.value })} />
              </Field>

              <Field label="Routing Number">
                <input
                  className={inputCls}
                  value={folderDeal.routing_number || ''}
                  onChange={(e) => setFolderDeal({ ...folderDeal, routing_number: e.target.value })}
                />
              </Field>

              <Field label="Account Number">
                <input
                  className={inputCls}
                  value={folderDeal.account_number || ''}
                  onChange={(e) => setFolderDeal({ ...folderDeal, account_number: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Notes">
                <textarea
                  className={`${inputCls} min-h-[110px]`}
                  value={folderDeal.note || folderDeal.notes || ''}
                  onChange={(e) => setFolderDeal({ ...folderDeal, note: e.target.value, notes: e.target.value })}
                  placeholder="Notes…"
                />
              </Field>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setFolderDeal(null)} className={closeBtn}>
                Cancel
              </button>
              <button onClick={saveFolder} className={saveBtn}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- helpers ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function agentName(agentId: string, profiles: Profile[]) {
  const p = profiles.find((x) => x.id === agentId)
  if (!p) return '—'
  const n = `${p.first_name || ''} ${p.last_name || ''}`.trim()
  return n || p.email || 'Agent'
}

function fmtMoney(n: any) {
  const num = Number(n)
  if (!Number.isFinite(num)) return ''
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function toNum(v: any) {
  if (v === null || v === undefined || v === '') return null
  const num = Number(String(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(num) ? num : null
}

function prettyDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}

function cleanPhone(raw: string) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length !== 10) return raw?.trim() || null
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function statusPill(status: string | null) {
  const s = (status || 'pending').toLowerCase()
  if (s === 'active') return 'text-[11px] px-2 py-1 rounded-xl border bg-green-500/12 border-green-400/25 text-green-200'
  if (s === 'chargeback') return 'text-[11px] px-2 py-1 rounded-xl border bg-red-500/12 border-red-400/25 text-red-200'
  if (s === 'pending') return 'text-[11px] px-2 py-1 rounded-xl border bg-yellow-500/12 border-yellow-400/25 text-yellow-200'
  return 'text-[11px] px-2 py-1 rounded-xl border bg-white/6 border-white/12 text-white/70'
}

function buildBoboNotifs(rows: Deal[]): BoboNotif[] {
  // Personal-only: derive alerts from ACTIVE deals (your closed business)
  const active = rows.filter((d) => (d.status || '').toLowerCase() === 'active')

  const out: BoboNotif[] = []
  for (const d of active) {
    const client = (d.full_name || 'Client').trim() || 'Client'
    const created = d.created_at ? new Date(d.created_at) : new Date()

    const stages: { stage: BoboNotif['stage']; ms: number; label: string; body: (c: string) => string }[] = [
      {
        stage: '24h',
        ms: 24 * 60 * 60 * 1000,
        label: '24hr Follow-up',
        body: (c) => `Call and nurture your newly closed deal (${c}).`,
      },
      {
        stage: '3d',
        ms: 3 * 24 * 60 * 60 * 1000,
        label: '3 Day Reminder',
        body: (c) => `Remind ${c} of payment.`,
      },
      {
        stage: '7d',
        ms: 7 * 24 * 60 * 60 * 1000,
        label: '7 Day Check-in',
        body: (c) => `Call ${c} and see if they got their paperwork in the mail.`,
      },
      {
        stage: '30d',
        ms: 30 * 24 * 60 * 60 * 1000,
        label: '30 Day Persistency',
        body: (c) => `Make sure ${c} premium stuck and issued.`,
      },
    ]

    stages.forEach((s) => {
      const dueAt = new Date(created.getTime() + s.ms)
      out.push({
        id: `${d.id}_${s.stage}`,
        deal_id: d.id,
        client,
        dueAt,
        label: s.label,
        body: s.body(client),
        stage: s.stage,
      })
    })
  }

  out.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
  return out
}

function filterNotifsForSearch(list: BoboNotif[], q: string) {
  const s = (q || '').trim().toLowerCase()
  if (!s) return list
  return list.filter((n) => `${n.label} ${n.body} ${n.client}`.toLowerCase().includes(s))
}

function readSeenMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem('flow_bobo_seen')
    if (!raw) return {}
    const j = JSON.parse(raw)
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

function writeSeenMap(map: Record<string, number>) {
  try {
    localStorage.setItem('flow_bobo_seen', JSON.stringify(map || {}))
  } catch {}
}

/* ---------- icons ---------- */

function BellIcon() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 22a2.3 2.3 0 0 0 2.2-1.7M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function GlassPencilIcon() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 20h9"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function GlassFolderIcon() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3.5 7.5h6l2 2H20.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-17a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M2 10h20"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

/* ---------- ui ---------- */

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'
const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

const th = 'text-left px-6 py-3 whitespace-nowrap'
const thRight = 'text-right px-6 py-3 whitespace-nowrap'
const td = 'px-6 py-4 text-white/80 whitespace-nowrap'
const tdStrong = 'px-6 py-4 font-semibold whitespace-nowrap'
const tdRight = 'px-6 py-4 text-right whitespace-nowrap'

const iconBtn =
  'rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs'

const closeBtn =
  'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold'

const saveBtn =
  'rounded-2xl bg-green-600 hover:bg-green-500 transition px-5 py-3 text-sm font-semibold'
