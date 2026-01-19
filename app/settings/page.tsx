// ✅ REPLACE ENTIRE FILE: /app/settings/page.tsx
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
  name: string
  supported_name: string | null
  advance_rate: number | null
  active: boolean | null
  sort_order: number | null
  eapp_url: string | null
  portal_url: string | null
  support_phone: string | null
  logo_url: string | null
}

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

const COMP_VALUES = Array.from({ length: 41 }, (_, i) => i * 5) // 0..200

function errMsg(e: any) {
  return e?.message || e?.error_description || e?.error || 'Something failed'
}

async function run<T>(
  setBusy: (v: boolean) => void,
  setToast: (v: string | null) => void,
  label: string,
  fn: () => Promise<T>
) {
  try {
    setBusy(true)
    setToast(null)
    const res = await fn()
    setToast(`${label} ✅`)
    return res
  } catch (e: any) {
    setToast(`${label} failed: ${errMsg(e)}`)
    throw e
  } finally {
    setBusy(false)
  }
}

export default function SettingsPage() {
  const [toast, setToast] = useState<string | null>(null)

  const [booting, setBooting] = useState(false)
  const [me, setMe] = useState<Profile | null>(null)

  const [tab, setTab] = useState<'profile' | 'agents' | 'positions' | 'carriers'>('profile')

  // Profile form
  const [pFirst, setPFirst] = useState('')
  const [pLast, setPLast] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')

  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Agents
  const [agents, setAgents] = useState<Profile[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [refreshingAgents, setRefreshingAgents] = useState(false)
  const [agentSearch, setAgentSearch] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviting, setInviting] = useState(false)

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

  // Positions
  const [pos, setPos] = useState({
    user_id: '',
    upline_id: '',
    comp: 70,
    effective_date: '',
  })
  const [savingPosition, setSavingPosition] = useState(false)

  // Carriers
  const [loadingCarriers, setLoadingCarriers] = useState(false)
  const [refreshingCarriers, setRefreshingCarriers] = useState(false)
  const [carriers, setCarriers] = useState<CarrierRow[]>([])
  const [carrierSearch, setCarrierSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [creatingCarrier, setCreatingCarrier] = useState(false)

  const [newCarrier, setNewCarrier] = useState({
    name: '',
    supported_name: '',
    advance_rate: '0.75',
    sort_order: '',
    active: true,
    eapp_url: '',
    portal_url: '',
    support_phone: '',
    logo_url: '',
  })

  const isAdmin = me?.role === 'admin'
  const isOwner = !!me?.is_agency_owner
  const canManageAgents = isAdmin || isOwner

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function authHeader() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? `Bearer ${token}` : ''
  }

  async function boot() {
    setBooting(true)
    setToast(null)
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const uid = userRes.user?.id
      if (!uid) {
        window.location.href = '/login'
        return
      }

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id,created_at,email,first_name,last_name,role,is_agency_owner,upline_id,comp,theme,avatar_url')
        .eq('id', uid)
        .single()
      if (profErr) throw profErr

      const p = prof as Profile
      setMe(p)
      setPFirst(p.first_name || '')
      setPLast(p.last_name || '')
      setPEmail(p.email || '')
      setAvatarPreview(p.avatar_url || '')

      if (p.role === 'admin' || !!p.is_agency_owner) {
        await loadAgents()
        setTab('agents')
      } else {
        setTab('profile')
      }

      if (p.role === 'admin') {
        await loadCarriers()
      }
    } catch (e: any) {
      setToast(`Boot failed: ${errMsg(e)}`)
    } finally {
      setBooting(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function saveProfile() {
    if (!me) return
    await run(setSavingProfile, setToast, 'Profile saved', async () => {
      const payload = {
        first_name: pFirst.trim() || null,
        last_name: pLast.trim() || null,
        email: pEmail.trim() || null,
        avatar_url: avatarPreview?.trim() || null,
      }
      const { error } = await supabase.from('profiles').update(payload).eq('id', me.id)
      if (error) throw error
      await boot()
    })
  }

  async function uploadAvatar(file: File) {
    if (!me) return
    await run(setUploadingAvatar, setToast, 'Avatar updated', async () => {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${me.id}.${ext}`

      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl

      const { error: upErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', me.id)
      if (upErr) throw upErr

      setAvatarPreview(url)
      await boot()
    })
  }

  async function loadAgents() {
    setLoadingAgents(true)
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5000)
      if (error) throw error
      setAgents((data || []) as Profile[])
    } catch (e: any) {
      setToast(`Could not load agents: ${errMsg(e)}`)
      setAgents([])
    } finally {
      setLoadingAgents(false)
    }
  }

  const filteredAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase()
    if (!q) return agents
    return agents.filter((a) => {
      const blob = [a.first_name, a.last_name, a.email].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(q)
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
    await run(setInviting, setToast, 'Invite sent', async () => {
      const token = await authHeader()
      if (!token) throw new Error('Not logged in')
      if (!invite.email.trim()) throw new Error('Email required')
      if (!invite.first_name.trim() || !invite.last_name.trim()) throw new Error('Name required')

      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({
          email: invite.email.trim(),
          first_name: invite.first_name.trim(),
          last_name: invite.last_name.trim(),
          upline_id: invite.upline_id || null,
          comp: invite.comp,
          role: invite.role,
          is_agency_owner: invite.is_agency_owner,
          theme: invite.theme,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Invite failed')

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
      await loadAgents()
    })
  }

  async function updatePosition() {
    await run(setSavingPosition, setToast, 'Position updated', async () => {
      const token = await authHeader()
      if (!token) throw new Error('Not logged in')
      if (!pos.user_id) throw new Error('Select a user')

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
      if (!res.ok) throw new Error(json.error || 'Update failed')

      setPos({ user_id: '', upline_id: '', comp: 70, effective_date: '' })
      await loadAgents()
    })
  }

  async function loadCarriers() {
    setLoadingCarriers(true)
    try {
      const { data, error } = await supabase
        .from('carriers')
        .select('id,created_at,name,supported_name,advance_rate,active,sort_order,eapp_url,portal_url,support_phone,logo_url')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true })
        .limit(5000)

      if (error) throw error
      setCarriers((data || []) as CarrierRow[])
    } catch (e: any) {
      setToast(`Could not load carriers: ${errMsg(e)}`)
      setCarriers([])
    } finally {
      setLoadingCarriers(false)
    }
  }

  const filteredCarriers = useMemo(() => {
    const q = carrierSearch.trim().toLowerCase()
    if (!q) return carriers
    return carriers.filter((c) => {
      const blob = [c.name, c.supported_name].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(q)
    })
  }, [carriers, carrierSearch])

  async function createCarrier() {
  await run(setCreatingCarrier, setToast, 'Carrier created', async () => {
    const name = newCarrier.name.trim()
    if (!name) throw new Error('Carrier name required')

    const adv = Number(newCarrier.advance_rate)
    if (!Number.isFinite(adv) || adv <= 0) throw new Error('Advance rate invalid')

    // ✅ sort_order is NOT NULL in your DB, so never send null
    const sort = newCarrier.sort_order.trim() ? Number(newCarrier.sort_order.trim()) : 999
    if (!Number.isFinite(sort)) throw new Error('Sort order invalid')

    const payload = {
      name,
      supported_name: newCarrier.supported_name.trim() || null,
      advance_rate: adv,
      active: !!newCarrier.active,
      sort_order: sort, // ✅ never null
      eapp_url: newCarrier.eapp_url.trim() || null,
      portal_url: newCarrier.portal_url.trim() || null,
      support_phone: newCarrier.support_phone.trim() || null,
      logo_url: newCarrier.logo_url.trim() || null,
    }

    const { error } = await supabase.from('carriers').insert(payload)
    if (error) throw error

    setCreateOpen(false)
    setNewCarrier({
      name: '',
      supported_name: '',
      advance_rate: '0.75',
      sort_order: '',
      active: true,
      eapp_url: '',
      portal_url: '',
      support_phone: '',
      logo_url: '',
    })

    await loadCarriers()
    await loadCarrierStats()
  })
}

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      {/* TOAST */}
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
              Profile{canManageAgents ? ' + Agent Management + Positions' : ''}{isAdmin ? ' + Carrier Config' : ''}
            </p>
            {booting && <div className="text-xs text-white/45 mt-2">Loading settings…</div>}
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
                <div className="text-xs text-white/55 mt-1">Update your profile details + avatar.</div>
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
                    disabled={uploadingAvatar}
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

            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className={saveWide + (savingProfile ? ' opacity-50 cursor-not-allowed' : '')}
            >
              {savingProfile ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        )}

        {/* AGENTS */}
        {tab === 'agents' && canManageAgents && (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-sm font-semibold">Agents</div>
                <div className="text-xs text-white/55 mt-1">Invite users + view roster. Buttons execute instantly.</div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setInviteOpen(true)} className={saveBtn}>
                  Add Agent
                </button>

                <button
                  onClick={() =>
                    run(setRefreshingAgents, setToast, 'Agents refreshed', async () => {
                      await loadAgents()
                    })
                  }
                  disabled={refreshingAgents}
                  className={btnGlass + (refreshingAgents ? ' opacity-50 cursor-not-allowed' : '')}
                >
                  {refreshingAgents ? 'Refreshing…' : 'Refresh'}
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
                <div className="col-span-3">Agent</div>
                <div className="col-span-4">Email</div>
                <div className="col-span-2 text-center">Role</div>
                <div className="col-span-2 text-right">Comp</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {loadingAgents && <div className="px-4 py-6 text-sm text-white/60">Loading…</div>}

              {!loadingAgents &&
                filteredAgents.map((a) => {
                  const name = `${a.first_name || '—'} ${a.last_name || ''}`.trim()
                  return (
                    <div key={a.id} className="grid grid-cols-12 px-4 py-3 border-b border-white/10 text-sm items-center">
                      <div className="col-span-3 font-semibold">
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

                      <div className="col-span-1 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setToast('Edit UI next (modal + save route)')}
                          className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-2 py-2"
                          title="Edit"
                        >
                          ✏️
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const ok = window.confirm(`Delete ${name}? This removes Auth + Profile.`)
                            if (!ok) return
                            try {
                              const token = await authHeader()
                              const res = await fetch('/api/admin/users/delete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: token },
                                body: JSON.stringify({ user_id: a.id }),
                              })
                              const json = await res.json().catch(() => ({}))
                              if (!res.ok) throw new Error(json.error || 'Delete failed')
                              setToast('User deleted ✅')
                              await loadAgents()
                            } catch (e: any) {
                              setToast(errMsg(e))
                            }
                          }}
                          className="rounded-xl border border-white/10 bg-white/5 hover:bg-red-600/30 transition px-2 py-2"
                          title="Delete"
                        >
                          🗑
                        </button>
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
                  <option value="">Select</option>
                  {uplineOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Upline">
                <select
                  className={inputCls}
                  value={pos.upline_id}
                  onChange={(e) => setPos((p) => ({ ...p, upline_id: e.target.value }))}
                >
                  <option value="">None</option>
                  {uplineOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Comp">
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

              <Field label="Effective Date (optional)" className="md:col-span-1">
                <input
                  type="date"
                  className={inputCls}
                  value={pos.effective_date}
                  onChange={(e) => setPos((p) => ({ ...p, effective_date: e.target.value }))}
                />
              </Field>

              <div className="md:col-span-2 flex items-end">
                <button
                  onClick={updatePosition}
                  disabled={savingPosition}
                  className={saveWide + (savingPosition ? ' opacity-50 cursor-not-allowed' : '')}
                >
                  {savingPosition ? 'Saving…' : 'Save Position'}
                </button>
              </div>
            </div>

            <div className="mt-5 text-xs text-white/45">
              Tip: Select user → pick upline + comp → save. Executes immediately.
            </div>
          </div>
        )}

        {/* CARRIERS */}
        {tab === 'carriers' && isAdmin && (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-sm font-semibold">Carriers</div>
                <div className="text-xs text-white/55 mt-1">Config + links. (Admin only.)</div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setCreateOpen(true)} className={saveBtn}>
                  Add Carrier
                </button>
                <button
                  onClick={() =>
                    run(setRefreshingCarriers, setToast, 'Carriers refreshed', async () => {
                      await loadCarriers()
                    })
                  }
                  disabled={refreshingCarriers}
                  className={btnGlass + (refreshingCarriers ? ' opacity-50 cursor-not-allowed' : '')}
                >
                  {refreshingCarriers ? 'Refreshing…' : 'Refresh'}
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

            {loadingCarriers && <div className="text-sm text-white/60">Loading…</div>}

            {!loadingCarriers && (
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-3 border-b border-white/10 text-[11px] text-white/60 bg-white/5">
                  <div className="col-span-3">Carrier</div>
                  <div className="col-span-2">Advance</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">E-App</div>
                  <div className="col-span-2">Portal</div>
                  <div className="col-span-1 text-right">Phone</div>
                </div>

                {filteredCarriers.map((c) => (
                  <div key={c.id} className="grid grid-cols-12 px-4 py-3 border-b border-white/10 text-sm items-center">
                    <div className="col-span-3 font-semibold">
                      {c.name}
                      {c.supported_name ? <span className="text-xs text-white/50"> • {c.supported_name}</span> : null}
                    </div>

                    <div className="col-span-2 text-white/80">{c.advance_rate ?? '—'}</div>

                    <div className="col-span-2">
                      <span className="text-[11px] px-2 py-1 rounded-xl border border-white/10 bg-white/5 text-white/70">
                        {c.active === false ? 'inactive' : 'active'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      {c.eapp_url ? (
                        <a className="text-white/80 hover:text-white underline" href={c.eapp_url} target="_blank" rel="noreferrer">
                          Open ↗
                        </a>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </div>

                    <div className="col-span-2">
                      {c.portal_url ? (
                        <a className="text-white/80 hover:text-white underline" href={c.portal_url} target="_blank" rel="noreferrer">
                          Open ↗
                        </a>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </div>

                    <div className="col-span-1 text-right text-white/70">{c.support_phone || '—'}</div>
                  </div>
                ))}

                {filteredCarriers.length === 0 && <div className="px-4 py-6 text-sm text-white/60">No carriers.</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* INVITE MODAL */}
      {inviteOpen && (
        <Modal title="Invite Agent" onClose={() => setInviteOpen(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="First Name">
              <input
                className={inputCls}
                value={invite.first_name}
                onChange={(e) => setInvite((x) => ({ ...x, first_name: e.target.value }))}
              />
            </Field>

            <Field label="Last Name">
              <input
                className={inputCls}
                value={invite.last_name}
                onChange={(e) => setInvite((x) => ({ ...x, last_name: e.target.value }))}
              />
            </Field>

            <Field label="Email" className="md:col-span-2">
              <input
                className={inputCls}
                value={invite.email}
                onChange={(e) => setInvite((x) => ({ ...x, email: e.target.value }))}
              />
            </Field>

            <Field label="Role">
              <select
                className={inputCls}
                value={invite.role}
                onChange={(e) => setInvite((x) => ({ ...x, role: e.target.value }))}
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </Field>

            <Field label="Comp">
              <select
                className={inputCls}
                value={invite.comp}
                onChange={(e) => setInvite((x) => ({ ...x, comp: Number(e.target.value) }))}
              >
                {COMP_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Upline" className="md:col-span-2">
              <select
                className={inputCls}
                value={invite.upline_id}
                onChange={(e) => setInvite((x) => ({ ...x, upline_id: e.target.value }))}
              >
                <option value="">None</option>
                {uplineOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Theme" className="md:col-span-2">
              <select
                className={inputCls}
                value={invite.theme}
                onChange={(e) => setInvite((x) => ({ ...x, theme: e.target.value }))}
              >
                {THEMES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-2 flex items-center gap-3">
              <input
                id="owner"
                type="checkbox"
                checked={invite.is_agency_owner}
                onChange={(e) => setInvite((x) => ({ ...x, is_agency_owner: e.target.checked }))}
              />
              <label htmlFor="owner" className="text-sm text-white/80">
                Agency Owner
              </label>
            </div>
          </div>

          <button
            onClick={inviteAgent}
            disabled={inviting}
            className={saveWide + (inviting ? ' opacity-50 cursor-not-allowed' : '')}
          >
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </Modal>
      )}

      {/* CREATE CARRIER MODAL */}
      {createOpen && (
        <Modal title="Add Carrier" onClose={() => setCreateOpen(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name">
              <input
                className={inputCls}
                value={newCarrier.name}
                onChange={(e) => setNewCarrier((x) => ({ ...x, name: e.target.value }))}
              />
            </Field>

            <Field label="Supported Name (optional)">
              <input
                className={inputCls}
                value={newCarrier.supported_name}
                onChange={(e) => setNewCarrier((x) => ({ ...x, supported_name: e.target.value }))}
              />
            </Field>

            <Field label="Advance Rate (e.g. 0.75)">
              <input
                className={inputCls}
                value={newCarrier.advance_rate}
                onChange={(e) => setNewCarrier((x) => ({ ...x, advance_rate: e.target.value }))}
              />
            </Field>

            <Field label="Sort Order (optional)">
              <input
                className={inputCls}
                value={newCarrier.sort_order}
                onChange={(e) => setNewCarrier((x) => ({ ...x, sort_order: e.target.value }))}
              />
            </Field>

            <Field label="E-App URL" className="md:col-span-2">
              <input
                className={inputCls}
                value={newCarrier.eapp_url}
                onChange={(e) => setNewCarrier((x) => ({ ...x, eapp_url: e.target.value }))}
              />
            </Field>

            <Field label="Portal URL" className="md:col-span-2">
              <input
                className={inputCls}
                value={newCarrier.portal_url}
                onChange={(e) => setNewCarrier((x) => ({ ...x, portal_url: e.target.value }))}
              />
            </Field>

            <Field label="Support Phone" className="md:col-span-1">
              <input
                className={inputCls}
                value={newCarrier.support_phone}
                onChange={(e) => setNewCarrier((x) => ({ ...x, support_phone: e.target.value }))}
              />
            </Field>

            <Field label="Logo URL (optional)" className="md:col-span-1">
              <input
                className={inputCls}
                value={newCarrier.logo_url}
                onChange={(e) => setNewCarrier((x) => ({ ...x, logo_url: e.target.value }))}
              />
            </Field>

            <div className="md:col-span-2 flex items-center gap-3">
              <input
                id="activeCarrier"
                type="checkbox"
                checked={newCarrier.active}
                onChange={(e) => setNewCarrier((x) => ({ ...x, active: e.target.checked }))}
              />
              <label htmlFor="activeCarrier" className="text-sm text-white/80">
                Active
              </label>
            </div>
          </div>

          <button
            onClick={createCarrier}
            disabled={creatingCarrier}
            className={saveWide + (creatingCarrier ? ' opacity-50 cursor-not-allowed' : '')}
          >
            {creatingCarrier ? 'Creating…' : 'Create Carrier'}
          </button>
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Components ---------------- */

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
        active ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10',
      ].join(' ')}
      type="button"
    >
      {children}
    </button>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className || ''}>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2">
        <div className="glass rounded-2xl border border-white/10 p-6 shadow-2xl">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="text-sm font-semibold">{title}</div>
            <button className={btnGlass} onClick={onClose} type="button">
              Close
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Styles ---------------- */

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnGlass =
  'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm font-semibold'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

const saveBtn =
  'rounded-2xl bg-blue-600 hover:bg-blue-500 transition px-4 py-2 text-sm font-semibold border border-white/10'

const saveWide =
  'mt-5 w-full rounded-2xl bg-blue-600 hover:bg-blue-500 transition px-4 py-3 text-sm font-semibold border border-white/10'

const dangerBtn =
  'rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-semibold hover:bg-red-500/15 transition'
