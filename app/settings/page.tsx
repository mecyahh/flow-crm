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
  role: string
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
  advance_rate: number
  active: boolean
  sort_order: number
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
  const [pTheme, setPTheme] = useState<string>('blue')
  const [avatarPreview, setAvatarPreview] = useState<string>('')

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

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [edit, setEdit] = useState({
    first_name: '',
    last_name: '',
    role: 'agent',
    is_agency_owner: false,
    comp: 70,
    upline_id: '',
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
    sort_order: '', // REQUIRED in DB (not-null)
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
      setPTheme(p.theme || 'blue')
      setAvatarPreview(p.avatar_url || '')

      const canAgents = p.role === 'admin' || !!p.is_agency_owner
      if (canAgents) {
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

  async function authHeader() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? `Bearer ${token}` : ''
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
        theme: pTheme || 'blue',
        avatar_url: avatarPreview?.trim() || null,
      }
      const { error } = await supabase.from('profiles').update(payload).eq('id', me.id)
      if (error) throw error

      // ThemeProvider will see this new value on refresh
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000)

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

  function openEdit(a: Profile) {
    setEditTarget(a)
    setEdit({
      first_name: a.first_name || '',
      last_name: a.last_name || '',
      role: a.role || 'agent',
      is_agency_owner: !!a.is_agency_owner,
      comp: typeof a.comp === 'number' ? a.comp : 70,
      upline_id: a.upline_id || '',
      theme: a.theme || 'blue',
    })
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editTarget) return
    await run(setEditSaving, setToast, 'Agent updated', async () => {
      const token = await authHeader()
      if (!token) throw new Error('Not logged in')

      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({
          user_id: editTarget.id,
          first_name: edit.first_name,
          last_name: edit.last_name,
          role: edit.role,
          is_agency_owner: edit.is_agency_owner,
          comp: edit.comp,
          upline_id: edit.upline_id || null,
          theme: edit.theme,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Update failed')

      setEditOpen(false)
      setEditTarget(null)
      await loadAgents()
    })
  }

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
        .order('sort_order', { ascending: true })
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
      const b = [c.name, c.supported_name].filter(Boolean).join(' ').toLowerCase()
      return b.includes(q)
    })
  }, [carriers, carrierSearch])

  async function createCarrier() {
    await run(setCreatingCarrier, setToast, 'Carrier created', async () => {
      const name = newCarrier.name.trim()
      if (!name) throw new Error('Carrier name required')

      const adv = Number(newCarrier.advance_rate)
      if (!Number.isFinite(adv) || adv <= 0) throw new Error('Advance rate invalid')

      const sort = newCarrier.sort_order.trim() ? Number(newCarrier.sort_order.trim()) : 999
      if (!Number.isFinite(sort)) throw new Error('Sort order invalid')

      const payload = {
        name,
        supported_name: newCarrier.supported_name.trim() || null,
        advance_rate: adv,
        active: !!newCarrier.active,
        sort_order: sort,
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
    })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />

          {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-[var(--cardBorder)] shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3 flex gap-2">
              <button className={btnSoft} onClick={() => setToast(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xl glass rounded-2xl border border-[var(--cardBorder)] p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-sm font-semibold">Edit Agent</div>
                <div className="text-xs text-[var(--muted)] mt-1">{editTarget?.email || '—'}</div>
              </div>
              <button onClick={() => setEditOpen(false)} className={btnGlass}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="First Name">
                <input
                  className={inputCls}
                  value={edit.first_name}
                  onChange={(e) => setEdit((p) => ({ ...p, first_name: e.target.value }))}
                />
              </Field>

              <Field label="Last Name">
                <input
                  className={inputCls}
                  value={edit.last_name}
                  onChange={(e) => setEdit((p) => ({ ...p, last_name: e.target.value }))}
                />
              </Field>

              <Field label="Role">
                <select className={inputCls} value={edit.role} onChange={(e) => setEdit((p) => ({ ...p, role: e.target.value }))}>
                  <option value="agent">agent</option>
                  <option value="admin">admin</option>
                </select>
              </Field>

              <Field label="Agency Owner">
                <select
                  className={inputCls}
                  value={edit.is_agency_owner ? 'yes' : 'no'}
                  onChange={(e) => setEdit((p) => ({ ...p, is_agency_owner: e.target.value === 'yes' }))}
                >
                  <option value="no">no</option>
                  <option value="yes">yes</option>
                </select>
              </Field>

              <Field label="Comp">
                <select className={inputCls} value={String(edit.comp)} onChange={(e) => setEdit((p) => ({ ...p, comp: Number(e.target.value) }))}>
                  {COMP_VALUES.map((n) => (
                    <option key={n} value={n}>
                      {n}%
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Upline">
                <select className={inputCls} value={edit.upline_id} onChange={(e) => setEdit((p) => ({ ...p, upline_id: e.target.value }))}>
                  <option value="">select</option>
                  {uplineOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Theme">
                <select className={inputCls} value={edit.theme} onChange={(e) => setEdit((p) => ({ ...p, theme: e.target.value }))}>
                  {THEMES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <button
              onClick={saveEdit}
              disabled={editSaving}
              className={saveWide + (editSaving ? ' opacity-50 cursor-not-allowed' : '')}
            >
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      <div className="ml-64 px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Profile{canManageAgents ? ' + Agents + Positions' : ''}{isAdmin ? ' + Carriers' : ''}
            </p>
            {booting && <div className="text-xs text-[var(--muted2)] mt-2">Loading settings…</div>}
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
          <div className="glass rounded-2xl border border-[var(--cardBorder)] p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <div className="text-sm font-semibold">My Profile</div>
                <div className="text-xs text-[var(--muted)] mt-1">Update your profile details + avatar + theme.</div>
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

              <Field label="Theme">
                <select className={inputCls} value={pTheme} onChange={(e) => setPTheme(e.target.value)}>
                  {THEMES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-[var(--muted2)] mt-2">
                  Changing theme updates the entire platform once saved.
                </div>
              </Field>

              <Field label="Profile Picture (Upload)">
                <div className="rounded-2xl border border-[var(--cardBorder)] bg-[var(--card)] px-4 py-3">
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-[var(--muted)]
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
                </div>
              </Field>
            </div>

            {avatarPreview && (
              <div className="mt-5 rounded-2xl border border-[var(--cardBorder)] bg-[var(--card)] p-4 flex items-center gap-4">
                <div className="text-xs text-[var(--muted)]">Preview</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarPreview}
                  alt="avatar"
                  className="h-12 w-12 rounded-2xl border border-[var(--cardBorder)] object-cover"
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
          <div className="glass rounded-2xl border border-[var(--cardBorder)] p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-sm font-semibold">Agents</div>
                <div className="text-xs text-[var(--muted)] mt-1">Invite users + view roster.</div>
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

            <div className="glass rounded-2xl border border-[var(--cardBorder)] px-3 py-2 flex items-center gap-2 mb-4">
              <input
                className="bg-transparent outline-none text-sm w-full placeholder:text-white/40"
                placeholder="Search agents…"
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-[var(--cardBorder)] overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-3 border-b border-[var(--cardBorder)] text-[11px] text-[var(--muted)] bg-[var(--card)]">
                <div className="col-span-3">Agent</div>
                <div className="col-span-4">Email</div>
                <div className="col-span-2 text-center">Role</div>
                <div className="col-span-2 text-right">Comp</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {loadingAgents && <div className="px-4 py-6 text-sm text-[var(--muted)]">Loading…</div>}

              {!loadingAgents &&
                filteredAgents.map((a) => {
                  const name = `${a.first_name || '—'} ${a.last_name || ''}`.trim()
                  return (
                    <div key={a.id} className="grid grid-cols-12 px-4 py-3 border-b border-[var(--cardBorder)] text-sm items-center">
                      <div className="col-span-3 font-semibold">
                        {name}
                        {a.is_agency_owner ? (
                          <span className="ml-2 text-[10px] px-2 py-1 rounded-xl border bg-[var(--card)] border-[var(--cardBorder)] text-[var(--muted)]">
                            Owner
                          </span>
                        ) : null}
                        {a.role === 'admin' ? (
                          <span className="ml-2 text-[10px] px-2 py-1 rounded-xl border bg-[var(--card)] border-[var(--cardBorder)] text-[var(--muted)]">
                            Admin
                          </span>
                        ) : null}
                      </div>

                      <div className="col-span-4 text-[var(--muted)]">{a.email || '—'}</div>
                      <div className="col-span-2 text-center text-[var(--muted)]">{a.role || 'agent'}</div>
                      <div className="col-span-2 text-right text-[var(--muted)]">
                        {typeof a.comp === 'number' ? `${a.comp}%` : '—'}
                      </div>

                      <div className="col-span-1 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          className="rounded-xl border border-[var(--cardBorder)] bg-[var(--card)] hover:bg-white/10 transition px-2 py-2"
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
                          className="rounded-xl border border-[var(--cardBorder)] bg-[var(--card)] hover:bg-red-600/30 transition px-2 py-2"
                          title="Delete"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  )
                })}

              {!loadingAgents && filteredAgents.length === 0 && (
                <div className="px-4 py-6 text-sm text-[var(--muted)]">No agents.</div>
              )}
            </div>

            {/* INVITE MODAL */}
            {inviteOpen && (
              <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 px-4">
                <div className="w-full max-w-xl glass rounded-2xl border border-[var(--cardBorder)] p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-sm font-semibold">Invite Agent</div>
                      <div className="text-xs text-[var(--muted)] mt-1">Creates user + sends invite link.</div>
                    </div>
                    <button onClick={() => setInviteOpen(false)} className={btnGlass}>
                      Close
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="First Name">
                      <input
                        className={inputCls}
                        value={invite.first_name}
                        onChange={(e) => setInvite((p) => ({ ...p, first_name: e.target.value }))}
                      />
                    </Field>

                    <Field label="Last Name">
                      <input
                        className={inputCls}
                        value={invite.last_name}
                        onChange={(e) => setInvite((p) => ({ ...p, last_name: e.target.value }))}
                      />
                    </Field>

                    <Field label="Email">
                      <input
                        className={inputCls}
                        value={invite.email}
                        onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))}
                      />
                    </Field>

                    <Field label="Role">
                      <select
                        className={inputCls}
                        value={invite.role}
                        onChange={(e) => setInvite((p) => ({ ...p, role: e.target.value }))}
                      >
                        <option value="agent">agent</option>
                        <option value="admin">admin</option>
                      </select>
                    </Field>

                    <Field label="Agency Owner">
                      <select
                        className={inputCls}
                        value={invite.is_agency_owner ? 'yes' : 'no'}
                        onChange={(e) => setInvite((p) => ({ ...p, is_agency_owner: e.target.value === 'yes' }))}
                      >
                        <option value="no">no</option>
                        <option value="yes">yes</option>
                      </select>
                    </Field>

                    <Field label="Comp">
                      <select
                        className={inputCls}
                        value={String(invite.comp)}
                        onChange={(e) => setInvite((p) => ({ ...p, comp: Number(e.target.value) }))}
                      >
                        {COMP_VALUES.map((n) => (
                          <option key={n} value={n}>
                            {n}%
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Upline">
                      <select
                        className={inputCls}
                        value={invite.upline_id}
                        onChange={(e) => setInvite((p) => ({ ...p, upline_id: e.target.value }))}
                      >
                        <option value="">select</option>
                        {uplineOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Theme">
                      <select
                        className={inputCls}
                        value={invite.theme}
                        onChange={(e) => setInvite((p) => ({ ...p, theme: e.target.value }))}
                      >
                        {THEMES.map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <div className="text-[11px] text-[var(--muted2)] mt-2">This sets the agent’s global app theme.</div>
                    </Field>
                  </div>

                  <button
                    onClick={inviteAgent}
                    disabled={inviting}
                    className={saveWide + (inviting ? ' opacity-50 cursor-not-allowed' : '')}
                  >
                    {inviting ? 'Sending…' : 'Send Invite'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* POSITIONS */}
        {tab === 'positions' && canManageAgents && (
          <div className="glass rounded-2xl border border-[var(--cardBorder)] p-6">
            <div className="text-sm font-semibold">Positions</div>
            <div className="text-xs text-[var(--muted)] mt-1">Update upline + comp. (Effective date optional.)</div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <Field label="Select User">
                <select
                  className={inputCls}
                  value={pos.user_id}
                  onChange={(e) => setPos((p) => ({ ...p, user_id: e.target.value }))}
                >
                  <option value="">select</option>
                  {uplineOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Upline">
                <select className={inputCls} value={pos.upline_id} onChange={(e) => setPos((p) => ({ ...p, upline_id: e.target.value }))}>
                  <option value="">select</option>
                  {uplineOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Comp">
                <select className={inputCls} value={String(pos.comp)} onChange={(e) => setPos((p) => ({ ...p, comp: Number(e.target.value) }))}>
                  {COMP_VALUES.map((n) => (
                    <option key={n} value={n}>
                      {n}%
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Effective Date (optional)">
                <input
                  className={inputCls}
                  value={pos.effective_date}
                  onChange={(e) => setPos((p) => ({ ...p, effective_date: e.target.value }))}
                  placeholder="YYYY-MM-DD"
                />
              </Field>
            </div>

            <button
              onClick={updatePosition}
              disabled={savingPosition}
              className={saveWide + (savingPosition ? ' opacity-50 cursor-not-allowed' : '')}
            >
              {savingPosition ? 'Saving…' : 'Save Position'}
            </button>
          </div>
        )}

        {/* CARRIERS */}
        {tab === 'carriers' && isAdmin && (
          <div className="glass rounded-2xl border border-[var(--cardBorder)] p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-sm font-semibold">Carriers</div>
                <div className="text-xs text-[var(--muted)] mt-1">Create and maintain carrier records. (Sort order required.)</div>
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

            <div className="glass rounded-2xl border border-[var(--cardBorder)] px-3 py-2 flex items-center gap-2 mb-4">
              <input
                className="bg-transparent outline-none text-sm w-full placeholder:text-white/40"
                placeholder="Search carriers…"
                value={carrierSearch}
                onChange={(e) => setCarrierSearch(e.target.value)}
              />
            </div>

            {loadingCarriers && <div className="text-sm text-[var(--muted)]">Loading…</div>}

            {!loadingCarriers && (
              <div className="rounded-2xl border border-[var(--cardBorder)] overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-3 border-b border-[var(--cardBorder)] text-[11px] text-[var(--muted)] bg-[var(--card)]">
                  <div className="col-span-3">Carrier</div>
                  <div className="col-span-2">Supported</div>
                  <div className="col-span-2 text-right">Advance</div>
                  <div className="col-span-2 text-right">Sort</div>
                  <div className="col-span-3 text-right">Links</div>
                </div>

                {filteredCarriers.map((c) => (
                  <div key={c.id} className="grid grid-cols-12 px-4 py-3 border-b border-[var(--cardBorder)] text-sm items-center">
                    <div className="col-span-3 font-semibold">{c.name}</div>
                    <div className="col-span-2 text-[var(--muted)]">{c.supported_name || '—'}</div>
                    <div className="col-span-2 text-right text-[var(--muted)]">{Number(c.advance_rate || 0).toFixed(2)}</div>
                    <div className="col-span-2 text-right text-[var(--muted)]">{c.sort_order}</div>
                    <div className="col-span-3 text-right text-xs text-[var(--muted)]">
                      {c.eapp_url ? (
                        <a className="hover:text-[var(--text)] underline" href={c.eapp_url} target="_blank" rel="noreferrer">
                          Eapp
                        </a>
                      ) : (
                        '—'
                      )}
                      {c.portal_url ? (
                        <>
                          {' '}
                          •{' '}
                          <a className="hover:text-[var(--text)] underline" href={c.portal_url} target="_blank" rel="noreferrer">
                            Portal
                          </a>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}

                {filteredCarriers.length === 0 && <div className="px-4 py-6 text-sm text-[var(--muted)]">No carriers.</div>}
              </div>
            )}

            {/* CREATE CARRIER MODAL */}
            {createOpen && (
              <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 px-4">
                <div className="w-full max-w-2xl glass rounded-2xl border border-[var(--cardBorder)] p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-sm font-semibold">Add Carrier</div>
                      <div className="text-xs text-[var(--muted)] mt-1">Sort order is required (DB constraint).</div>
                    </div>
                    <button onClick={() => setCreateOpen(false)} className={btnGlass}>
                      Close
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Name">
                      <input className={inputCls} value={newCarrier.name} onChange={(e) => setNewCarrier((p) => ({ ...p, name: e.target.value }))} />
                    </Field>

                    <Field label="Supported Name">
                      <input
                        className={inputCls}
                        value={newCarrier.supported_name}
                        onChange={(e) => setNewCarrier((p) => ({ ...p, supported_name: e.target.value }))}
                      />
                    </Field>

                    <Field label="Advance Rate">
                      <input
                        className={inputCls}
                        value={newCarrier.advance_rate}
                        onChange={(e) => setNewCarrier((p) => ({ ...p, advance_rate: e.target.value }))}
                        placeholder="0.75"
                      />
                    </Field>

                    <Field label="Sort Order (required)">
                      <input
                        className={inputCls}
                        value={newCarrier.sort_order}
                        onChange={(e) => setNewCarrier((p) => ({ ...p, sort_order: e.target.value }))}
                        placeholder="10"
                      />
                    </Field>

                    <Field label="E-App URL">
                      <input className={inputCls} value={newCarrier.eapp_url} onChange={(e) => setNewCarrier((p) => ({ ...p, eapp_url: e.target.value }))} />
                    </Field>

                    <Field label="Portal URL">
                      <input className={inputCls} value={newCarrier.portal_url} onChange={(e) => setNewCarrier((p) => ({ ...p, portal_url: e.target.value }))} />
                    </Field>

                    <Field label="Support Phone">
                      <input
                        className={inputCls}
                        value={newCarrier.support_phone}
                        onChange={(e) => setNewCarrier((p) => ({ ...p, support_phone: e.target.value }))}
                      />
                    </Field>

                    <Field label="Logo URL">
                      <input className={inputCls} value={newCarrier.logo_url} onChange={(e) => setNewCarrier((p) => ({ ...p, logo_url: e.target.value }))} />
                    </Field>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={newCarrier.active}
                        onChange={(e) => setNewCarrier((p) => ({ ...p, active: e.target.checked }))}
                      />
                      Active
                    </label>
                  </div>

                  <button
                    onClick={createCarrier}
                    disabled={creatingCarrier}
                    className={saveWide + (creatingCarrier ? ' opacity-50 cursor-not-allowed' : '')}
                  >
                    {creatingCarrier ? 'Creating…' : 'Create Carrier'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- UI bits ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--muted)] mb-2">{label}</div>
      {children}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
          onClick={onClick}
      className={[
        'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
        active
          ? 'border-white/20 bg-white/10'
          : 'border-white/10 bg-white/5 hover:bg-white/10',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/10 placeholder:text-white/40'

const btnGlass =
  'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm font-semibold'

const btnSoft =
  'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

/**
 * ✅ Theme-aware buttons:
 * Your ThemeProvider sets --accent and --accent2.
 * These buttons now follow the selected theme automatically.
 */
const saveBtn =
  'rounded-2xl px-4 py-2 text-sm font-semibold transition shadow-[0_0_0_1px_rgba(255,255,255,0.08)] bg-[var(--accent)] hover:opacity-90 text-[var(--accentText)]'

const saveWide =
  'mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition shadow-[0_0_0_1px_rgba(255,255,255,0.08)] bg-[var(--accent)] hover:opacity-90 text-[var(--accentText)]'

const dangerBtn =
  'rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-semibold hover:bg-red-500/15 transition'
