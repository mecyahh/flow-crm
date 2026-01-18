'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  created_at?: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string // 'agent' | 'admin'
  is_agency_owner: boolean
  upline_id?: string | null
  comp?: number | null
  theme?: string | null
  avatar_url: string | null
}

type CarrierRow = {
  id: string
  created_at: string
  custom_name: string
  supported_name: string
  advance_rate: number
  is_active: boolean
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

const THEMES = [
  { key: 'blue', label: 'Grey / Blue / White' },
  { key: 'gold', label: 'Grey / Gold / Black & White' },
  { key: 'green', label: 'Grey / Green / White' },
  { key: 'red', label: 'Grey / Red / Black & White' },
  { key: 'mono', label: 'Grey / White' },
  { key: 'fuchsia', label: 'Grey / Fuchsia' },
  { key: 'bw', label: 'White / Black' },
  { key: 'orange', label: 'Grey / Orange' },
] as const

const COMP_VALUES = Array.from({ length: 41 }, (_, i) => i * 5) // 0..200 in 5% steps

export default function SettingsPage() {
  const [toast, setToast] = useState<string | null>(null)
  const [me, setMe] = useState<Profile | null>(null)

  const [tab, setTab] = useState<'profile' | 'agents' | 'positions' | 'carriers'>('profile')

  // Profile
  const [pFirst, setPFirst] = useState('')
  const [pLast, setPLast] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string>('')

  // Agents (admin/owner)
  const [agents, setAgents] = useState<Profile[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [agentSearch, setAgentSearch] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)

  const [invite, setInvite] = useState({
    first_name: '',
    last_name: '',
    email: '',
    upline_id: '',
    comp: 70,
    role: 'agent',
    is_agency_owner: false,
    theme: 'blue',
  })

  // Positions (admin/owner)
  const [pos, setPos] = useState({
    user_id: '',
    upline_id: '',
    comp: 70,
    effective_date: '', // optional (stored by your API if supported)
  })

  // Carriers (admin only)
  const [loadingCarriers, setLoadingCarriers] = useState(false)
  const [carriers, setCarriers] = useState<CarrierRow[]>([])
  const [carrierSearch, setCarrierSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newCarrier, setNewCarrier] = useState({
    custom_name: '',
    supported_name: 'Aetna',
    advance_rate: '0.75',
  })

  // stats
  const [dealCountsBySupported, setDealCountsBySupported] = useState<Map<string, number>>(new Map())
  const [productCountsByCarrier, setProductCountsByCarrier] = useState<Map<string, number>>(new Map())

  const isAdmin = me?.role === 'admin'
  const isOwner = !!me?.is_agency_owner
  const canManageAgents = isAdmin || isOwner

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

    const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (profErr || !prof) return

    const p = prof as Profile
    setMe(p)

    setPFirst(p.first_name || '')
    setPLast(p.last_name || '')
    setPEmail(p.email || '')
    setAvatarPreview(p.avatar_url || '')

    // load agents for admin/owner
    if (p.role === 'admin' || p.is_agency_owner) {
      await loadAgents()
    }

    // admin-only load carriers
    if (p.role === 'admin') {
      await loadCarriers()
      await loadCarrierStats()
    }

    // default tab
    if (p.role === 'admin' || p.is_agency_owner) setTab('agents')
    else setTab('profile')
  }

  async function authHeader() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? `Bearer ${token}` : ''
  }

  async function saveProfile() {
    if (!me) return
    const payload = {
      first_name: pFirst.trim() || null,
      last_name: pLast.trim() || null,
      email: pEmail.trim() || null,
      avatar_url: avatarPreview?.trim() || null,
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', me.id)
    if (error) return setToast('Save failed')
    setToast('Saved ✅')
    boot()
  }

  async function uploadAvatar(file: File) {
    if (!me) return
    const ext = file.name.split('.').pop() || 'png'
    const path = `${me.id}.${ext}`

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) {
      setToast('Upload failed')
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = data.publicUrl

    const { error: upErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', me.id)
    if (upErr) {
      setToast('Could not save avatar')
      return
    }

    setAvatarPreview(url)
    setToast('Profile picture updated ✅')
    boot()
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function loadAgents() {
    setLoadingAgents(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) setToast('Could not load agents')
    setAgents((data || []) as Profile[])
    setLoadingAgents(false)
  }

  const filteredAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase()
    if (!q) return agents
    return agents.filter((a) => {
      const b = [a.first_name, a.last_name, a.email].filter(Boolean).join(' ').toLowerCase()
      return b.includes(q)
    })
  }, [agents, agentSearch])

  const uplineOptions = useMemo(() => {
    return agents
      .slice()
      .sort((a, b) => {
        const an = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase()
        const bn = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase()
        return an.localeCompare(bn)
      })
      .map((a) => ({
        id: a.id,
        label: `${(a.first_name || '').trim()} ${(a.last_name || '').trim()}${a.email ? ` • ${a.email}` : ''}`.trim(),
      }))
  }, [agents])

  async function inviteAgent() {
    const token = await authHeader()
    if (!token) return setToast('Not logged in')

    if (!invite.email.trim()) return setToast('Email required')

    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({
        email: invite.email.trim(),
        first_name: invite.first_name.trim() || null,
        last_name: invite.last_name.trim() || null,
        upline_id: invite.upline_id || null,
        comp: invite.comp,
        role: invite.role,
        is_agency_owner: invite.is_agency_owner,
        theme: invite.theme,
      }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(json.error || 'Invite failed')

    setToast('Invite sent ✅')
    setInviteOpen(false)
    setInvite({
      first_name: '',
      last_name: '',
      email: '',
      upline_id: '',
      comp: 70,
      role: 'agent',
      is_agency_owner: false,
      theme: 'blue',
    })
    loadAgents()
  }

  async function updatePosition() {
    const token = await authHeader()
    if (!token) return setToast('Not logged in')
    if (!pos.user_id) return setToast('Select a user')

    const res = await fetch('/api/admin/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({
        user_id: pos.user_id,
        upline_id: pos.upline_id || null,
        comp: pos.comp,
        effective_date: pos.effective_date || null,
      }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) return setToast(json.error || 'Update failed')

    setToast('Position updated ✅')
    setPos({ user_id: '', upline_id: '', comp: 70, effective_date: '' })
    loadAgents()
  }

  async function loadCarriers() {
    setLoadingCarriers(true)
    const { data, error } = await supabase
      .from('carriers')
      .select('id,created_at,custom_name,supported_name,advance_rate,is_active')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) setToast('Could not load carriers')
    setCarriers((data || []) as CarrierRow[])
    setLoadingCarriers(false)
  }

  async function loadCarrierStats() {
    const { data: deals } = await supabase.from('deals').select('id,company').limit(50000)
    const mapDeals = new Map<string, number>()
    ;(deals || []).forEach((d: any) => {
      const key = (d.company || '').trim()
      if (!key) return
      mapDeals.set(key, (mapDeals.get(key) || 0) + 1)
    })
    setDealCountsBySupported(mapDeals)

    const { data: prod } = await supabase.from('carrier_products').select('id,carrier_id').limit(50000)
    const mapProds = new Map<string, number>()
    ;(prod || []).forEach((p: any) => {
      mapProds.set(p.carrier_id, (mapProds.get(p.carrier_id) || 0) + 1)
    })
    setProductCountsByCarrier(mapProds)
  }

  const filteredCarriers = useMemo(() => {
    const q = carrierSearch.trim().toLowerCase()
    if (!q) return carriers
    return carriers.filter((c) => {
      const b = [c.custom_name, c.supported_name].join(' ').toLowerCase()
      return b.includes(q)
    })
  }, [carriers, carrierSearch])

  async function createCarrier() {
    const custom = newCarrier.custom_name.trim()
    if (!custom) return setToast('Custom name required')
    const supported = newCarrier.supported_name.trim()
    const adv = Number(newCarrier.advance_rate)
    if (!Number.isFinite(adv) || adv <= 0) return setToast('Advance rate invalid')

    const { error } = await supabase.from('carriers').insert({
      custom_name: custom,
      supported_name: supported,
      advance_rate: adv,
      is_active: true,
    })

    if (error) return setToast('Create failed (RLS?)')

    setToast('Carrier created ✅')
    setCreateOpen(false)
    setNewCarrier({ custom_name: '', supported_name: 'Aetna', advance_rate: '0.75' })
    await loadCarriers()
    await loadCarrierStats()
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
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-white/60 mt-1">
              Profile + {canManageAgents ? 'Agent Management' : 'Basics'} {isAdmin ? '+ Carrier Config' : ''}
            </p>
          </div>

          <div className="flex gap-2">
            <TabBtn active={tab === 'profile'} onClick={() => setTab('profile')}>
              Profile
            </TabBtn>

            {canManageAgents && (
              <>
                <TabBtn active={tab === 'agents'} onClick={() => setTab('agents')}>
                  Agents
                </TabBtn>
                <TabBtn active={tab === 'positions'} onClick={() => setTab('positions')}>
                  Positions
                </TabBtn>
              </>
            )}

            {isAdmin && (
              <TabBtn active={tab === 'carriers'} onClick={() => setTab('carriers')}>
                Carriers
              </TabBtn>
            )}
          </div>
        </div>

        {/* PROFILE */}
        {tab === 'profile' && (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <div className="text-sm font-semibold">My Profile</div>
                <div className="text-xs text-white/55 mt-1">Keep it clean + modern.</div>
              </div>
              <button onClick={logout} className={dangerBtn}>
                Log out
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="First Name">
                <input className={inputCls} value={pFirst} onChange={(e) => setPFirst(e.target.value)} />
              </Field>

              <Field label="Last Name">
                <input className={inputCls} value={pLast} onChange={(e) => setPLast(e.target.value)} />
              </Field>

              <Field label="Email">
                <input className={inputCls} value={pEmail} onChange={(e) => setPEmail(e.target.value)} />
              </Field>

              <Field label="Profile Picture (Upload)">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-white/70
                      file:mr-4 file:rounded-xl file:border-0
                      file:bg-white/10 file:px-4 file:py-2
                      file:text-sm file:font-semibold
                      hover:file:bg-white/20 transition"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadAvatar(f)
                    }}
                  />
                  <div className="text-[11px] text-white/55 mt-2">
                    Uploads to Supabase Storage bucket: <b>avatars</b>
                  </div>
                </div>
              </Field>
            </div>

            {avatarPreview && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-4">
                <div className="text-xs text-white/60">Preview</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarPreview}
                  alt="avatar"
                  className="h-12 w-12 rounded-2xl border border-white/10 object-cover"
                />
              </div>
            )}

            <button onClick={saveProfile} className={saveWide}>
              Save Profile
            </button>
          </div>
        )}

        {/* AGENTS */}
        {tab === 'agents' && canManageAgents && (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-sm font-semibold">Agents</div>
                <div className="text-xs text-white/55 mt-1">Invite users + view current roster.</div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setInviteOpen(true)} className={saveBtn}>
                  Add Agent
                </button>
                <button onClick={loadAgents} className={btnGlass}>
                  Refresh
                </button>
              </div>
            </div>

            <div className="glass rounded-2xl border border-white/10 px-3 py-2 flex items-center gap-2 mb-4">
              <input
                className="bg-transparent outline-none text-sm w-full placeholder:text-white/40"
                placeholder="Search agents…"
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-3 border-b border-white/10 text-[11px] text-white/60 bg-white/5">
                <div className="col-span-4">Agent</div>
                <div className="col-span-4">Email</div>
                <div className="col-span-2 text-center">Role</div>
                <div className="col-span-2 text-right">Comp</div>
              </div>

              {loadingAgents && <div className="px-4 py-6 text-sm text-white/60">Loading…</div>}

              {!loadingAgents &&
                filteredAgents.map((a) => {
                  const name = `${a.first_name || '—'} ${a.last_name || ''}`.trim()
                  return (
                    <div key={a.id} className="grid grid-cols-12 px-4 py-3 border-b border-white/10 text-sm">
                      <div className="col-span-4 font-semibold">
                        {name}
                        {a.is_agency_owner ? (
                          <span className="ml-2 text-[10px] px-2 py-1 rounded-xl border bg-white/5 border-white/10 text-white/70">
                            Owner
                          </span>
                        ) : null}
                        {a.role === 'admin' ? (
                          <span className="ml-2 text-[10px] px-2 py-1 rounded-xl border bg-white/5 border-white/10 text-white/70">
                            Admin
                          </span>
                        ) : null}
                      </div>
                      <div className="col-span-4 text-white/75">{a.email || '—'}</div>
                      <div className="col-span-2 text-center text-white/70">{a.role || 'agent'}</div>
                      <div className="col-span-2 text-right text-white/80">
                        {typeof a.comp === 'number' ? `${a.comp}%` : '—'}
                      </div>
                    </div>
                  )
                })}

              {!loadingAgents && filteredAgents.length === 0 && (
                <div className="px-4 py-6 text-sm text-white/60">No agents.</div>
              )}
            </div>
          </div>
        )}

        {/* POSITIONS */}
        {tab === 'positions' && canManageAgents && (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="text-sm font-semibold">Positions</div>
            <div className="text-xs text-white/55 mt-1">Update upline + comp. (Effective date optional.)</div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <Field label="Select User">
                <select
                  className={inputCls}
                  value={pos.user_id}
                  onChange={(e) => setPos((p) => ({ ...p, user_id: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {uplineOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Upline (optional)">
                <select
                  className={inputCls}
                  value={pos.upline_id}
                  onChange={(e) => setPos((p) => ({ ...p, upline_id: e.target.value }))}
                >
                  <option value="">None…</option>
                  {uplineOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Comp % (5% increments)">
                <select
                  className={inputCls}
                  value={pos.comp}
                  onChange={(e) => setPos((p) => ({ ...p, comp: Number(e.target.value) }))}
                >
                  {COMP_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {v}%
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Effective Date (optional)">
              <input
                className={inputCls}
                value={pos.effective_date}
                onChange={(e) => setPos((p) => ({ ...p, effective_date: e.target.value }))}
                placeholder="YYYY-MM-DD"
              />
            </Field>

            <button onClick={updatePosition} className={saveWide}>
              Save Position
            </button>

            <div className="mt-3 text-xs text-white/50">
              If this fails, your <b>/api/admin/position</b> route or RLS is blocking updates.
            </div>
          </div>
        )}

        {/* CARRIERS */}
        {tab === 'carriers' && isAdmin && (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-sm font-semibold">Carriers</div>
                <div className="text-xs text-white/55 mt-1">Admin-only. Click a carrier row to open details.</div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setCreateOpen(true)} className={saveBtn}>
                  Create Carrier
                </button>
                <button
                  onClick={async () => {
                    await loadCarriers()
                    await loadCarrierStats()
                  }}
                  className={btnGlass}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="glass rounded-2xl border border-white/10 px-3 py-2 flex items-center gap-2 mb-4">
              <input
                className="bg-transparent outline-none text-sm w-full placeholder:text-white/40"
                placeholder="Search carriers…"
                value={carrierSearch}
                onChange={(e) => setCarrierSearch(e.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-3 border-b border-white/10 text-[11px] text-white/60 bg-white/5">
                <div className="col-span-3">Carrier</div>
                <div className="col-span-3">Supported Name</div>
                <div className="col-span-2 text-center">Policies Sold</div>
                <div className="col-span-2 text-center">Products</div>
                <div className="col-span-2 text-right">Advance Rate</div>
              </div>

              {loadingCarriers && <div className="px-4 py-6 text-sm text-white/60">Loading…</div>}

              {!loadingCarriers &&
                filteredCarriers.map((c) => {
                  const policies = dealCountsBySupported.get((c.supported_name || '').trim()) || 0
                  const products = productCountsByCarrier.get(c.id) || 0
                  return (
                    <button
                      key={c.id}
                      onClick={() => (window.location.href = `/settings/carriers/${c.id}`)}
                      className="w-full text-left grid grid-cols-12 px-4 py-3 border-b border-white/10 hover:bg-white/5 transition text-sm"
                    >
                      <div className="col-span-3 font-semibold">{c.custom_name}</div>
                      <div className="col-span-3 text-white/80">{c.supported_name}</div>
                      <div className="col-span-2 text-center">{policies}</div>
                      <div className="col-span-2 text-center">{products}</div>
                      <div className="col-span-2 text-right text-white/80">{Number(c.advance_rate).toFixed(2)}</div>
                    </button>
                  )
                })}

              {!loadingCarriers && filteredCarriers.length === 0 && (
                <div className="px-4 py-6 text-sm text-white/60">No carriers.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* INVITE MODAL */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="glass rounded-2xl border border-white/10 p-6 w-full max-w-3xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Add Agent</div>
                <div className="text-xs text-white/55 mt-1">Sends an email invite to create their login.</div>
              </div>

              <button onClick={() => setInviteOpen(false)} className={closeBtn}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="First Name">
                <input className={inputCls} value={invite.first_name} onChange={(e) => setInvite((p) => ({ ...p, first_name: e.target.value }))} />
              </Field>

              <Field label="Last Name">
                <input className={inputCls} value={invite.last_name} onChange={(e) => setInvite((p) => ({ ...p, last_name: e.target.value }))} />
              </Field>

              <Field label="Email">
                <input className={inputCls} value={invite.email} onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))} />
              </Field>

              <Field label="Upline (optional)">
                <select className={inputCls} value={invite.upline_id} onChange={(e) => setInvite((p) => ({ ...p, upline_id: e.target.value }))}>
                  <option value="">None…</option>
                  {uplineOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Comp %">
                <select className={inputCls} value={invite.comp} onChange={(e) => setInvite((p) => ({ ...p, comp: Number(e.target.value) }))}>
                  {COMP_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {v}%
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Role">
                <select className={inputCls} value={invite.role} onChange={(e) => setInvite((p) => ({ ...p, role: e.target.value }))}>
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>

              <Field label="Agency Owner">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={invite.is_agency_owner}
                    onChange={(e) => setInvite((p) => ({ ...p, is_agency_owner: e.target.checked }))}
                    className="h-5 w-5"
                  />
                  <div className="text-sm">Mark as Agency Owner</div>
                </div>
              </Field>

              <Field label="Theme">
                <select className={inputCls} value={invite.theme} onChange={(e) => setInvite((p) => ({ ...p, theme: e.target.value }))}>
                  {THEMES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setInviteOpen(false)} className={closeBtn}>
                Cancel
              </button>
              <button onClick={inviteAgent} className={saveBtn}>
                Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CARRIER MODAL */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="glass rounded-2xl border border-white/10 p-6 w-full max-w-2xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Add a Carrier</div>
                <div className="text-xs text-white/55 mt-1">Admin-only</div>
              </div>
              <button onClick={() => setCreateOpen(false)} className={closeBtn}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Custom name">
                <input
                  className={inputCls}
                  value={newCarrier.custom_name}
                  onChange={(e) => setNewCarrier((p) => ({ ...p, custom_name: e.target.value }))}
                  placeholder="American Amicable"
                />
              </Field>

              <Field label="Supported name">
                <select
                  className={inputCls}
                  value={newCarrier.supported_name}
                  onChange={(e) => setNewCarrier((p) => ({ ...p, supported_name: e.target.value }))}
                >
                  {SUPPORTED_NAMES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Advance rate (ex: .75)">
                <input
                  className={inputCls}
                  value={newCarrier.advance_rate}
                  onChange={(e) => setNewCarrier((p) => ({ ...p, advance_rate: e.target.value }))}
                  placeholder="0.75"
                />
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
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
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
        active ? 'bg-white/10 border-white/15' : 'bg-white/5 border-white/10 hover:bg-white/10',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'

const closeBtn =
  'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold'

const saveBtn =
  'rounded-2xl bg-green-600 hover:bg-green-500 transition px-5 py-3 text-sm font-semibold'

const saveWide =
  'mt-5 w-full rounded-2xl bg-green-600 hover:bg-green-500 transition px-4 py-3 text-sm font-semibold'

const dangerBtn =
  'rounded-2xl bg-red-600 hover:bg-red-500 transition px-4 py-3 text-sm font-semibold'
