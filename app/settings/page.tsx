// /app/settings/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type Profile = {
  id: string
  created_at?: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  upline_id: string | null
  comp: number | null
  is_agency_owner: boolean | null
  theme: string | null
  avatar_url: string | null
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

const COMP_VALUES = Array.from({ length: 16 }, (_, i) => 70 + i * 5) // 70..145

export default function SettingsPage() {
  const [toast, setToast] = useState<string | null>(null)
  const [me, setMe] = useState<Profile | null>(null)

  const [tab, setTab] = useState<'profile' | 'agents' | 'positions' | 'themes'>('agents')

  // profile
  const [pFirst, setPFirst] = useState('')
  const [pLast, setPLast] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [pAvatar, setPAvatar] = useState('')

  // agents
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [agents, setAgents] = useState<Profile[]>([])
  const [agentSearch, setAgentSearch] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)

  const [invite, setInvite] = useState({
    first_name: '',
    last_name: '',
    email: '',
    upline_id: '',
    comp: 70,
    is_agency_owner: false,
    theme: 'blue',
    role: 'agent',
  })

  // positions
  const [pos, setPos] = useState({
    user_id: '',
    comp: 70,
    effective_date: '',
  })

  // themes
  const [themePick, setThemePick] = useState('blue')

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

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (!prof) return

    const p = prof as Profile
    setMe(p)

    setPFirst(p.first_name || '')
    setPLast(p.last_name || '')
    setPEmail(p.email || '')
    setPAvatar(p.avatar_url || '')

    setThemePick(p.theme || 'blue')

    const isAdmin = (p.role || '').toLowerCase() === 'admin'
    if (isAdmin) {
      await loadAgents()
      setTab('agents')
    } else {
      setTab('profile')
    }
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

  async function authHeader() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? `Bearer ${token}` : ''
  }

  async function inviteAgent() {
    const token = await authHeader()
    if (!token) return setToast('Not logged in')

    const body = {
      email: invite.email,
      first_name: invite.first_name,
      last_name: invite.last_name,
      upline_id: invite.upline_id || null,
      comp: invite.comp,
      is_agency_owner: invite.is_agency_owner,
      theme: invite.theme,
      role: invite.role,
    }

    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify(body),
    })

    const json = await res.json()
    if (!res.ok) return setToast(json.error || 'Invite failed')

    setToast('Invite sent ✅')
    setInviteOpen(false)
    setInvite({
      first_name: '',
      last_name: '',
      email: '',
      upline_id: '',
      comp: 70,
      is_agency_owner: false,
      theme: 'blue',
      role: 'agent',
    })
    loadAgents()
  }

  async function updatePosition() {
    const token = await authHeader()
    if (!token) return setToast('Not logged in')

    const res = await fetch('/api/admin/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify(pos),
    })

    const json = await res.json()
    if (!res.ok) return setToast(json.error || 'Update failed')

    setToast('Position updated ✅')
    setPos({ user_id: '', comp: 70, effective_date: '' })
    loadAgents()
  }

  async function saveProfile() {
    if (!me) return
    const payload = {
      first_name: pFirst.trim() || null,
      last_name: pLast.trim() || null,
      email: pEmail.trim() || null,
      avatar_url: pAvatar.trim() || null,
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', me.id)
    if (error) return setToast('Save failed')
    setToast('Saved ✅')
    boot()
  }

    async function saveTheme() {
    if (!me) return
    if (!me.is_agency_owner && me.role !== 'admin') return setToast('Only agency owners can change theme')

    const { error } = await supabase.from('profiles').update({ theme: themePick }).eq('id', me.id)
    if (error) return setToast('Save failed')

    setToast('Theme saved ✅')
    // hard refresh so theme applies instantly everywhere
    window.location.reload()
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
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
            <p className="text-sm text-white/60 mt-1">Profile + Agents + Positions + Themes</p>
          </div>

          <div className="flex gap-2">
            {(['profile', 'agents', 'positions', 'themes'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={[
                  'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                  tab === k ? 'bg-white/10 border-white/15' : 'bg-white/5 border-white/10 hover:bg-white/10',
                ].join(' ')}
              >
                {k === 'profile'
                  ? 'Profile'
                  : k === 'agents'
                  ? 'Agents'
                  : k === 'positions'
                  ? 'Positions'
                  : 'Themes'}
              </button>
            ))}

            <button onClick={logout} className={logoutBtn}>
              Log out
            </button>
          </div>
        </div>

        {/* PROFILE */}
        {tab === 'profile' && (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="text-sm font-semibold mb-4">My Profile</div>

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
              <Field label="Profile Picture URL">
                <input
                  className={inputCls}
                  value={pAvatar}
                  onChange={(e) => setPAvatar(e.target.value)}
                  placeholder="https://..."
                />
              </Field>
            </div>

            <button onClick={saveProfile} className={saveWide}>
              Save Profile
            </button>
          </div>
        )}

        {/* AGENTS */}
        {tab === 'agents' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold">Agents</div>
                  <div className="text-xs text-white/55 mt-1">Invite + manage uplines & comp.</div>
                </div>

                <button onClick={() => setInviteOpen(true)} className={saveBtn}>
                  Add Agent
                </button>
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
                <div className="px-4 py-3 bg-white/5 flex items-center justify-between">
                  <div className="text-xs font-semibold">Directory</div>
                  <button onClick={loadAgents} className={btnSoft}>
                    Refresh
                  </button>
                </div>

                {loadingAgents && <div className="px-4 py-6 text-sm text-white/60">Loading…</div>}

                {!loadingAgents && (
                  <div className="max-h-[520px] overflow-auto">
                    {filteredAgents.map((a) => (
                      <div
                        key={a.id}
                        className="px-4 py-3 border-t border-white/10 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-semibold">
                            {(a.first_name || '—')} {(a.last_name || '')}
                            {a.is_agency_owner ? (
                              <span className="ml-2 text-[10px] px-2 py-1 rounded-xl border bg-white/5 border-white/10 text-white/70">
                                Owner
                              </span>
                            ) : null}
                            {(a.role || '').toLowerCase() === 'admin' ? (
                              <span className="ml-2 text-[10px] px-2 py-1 rounded-xl border bg-white/5 border-white/10 text-white/70">
                                Admin
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-white/55 mt-1">{a.email || '—'}</div>
                        </div>

                        <div className="text-xs text-white/65">
                          <span className="px-2 py-1 rounded-xl border border-white/10 bg-white/5">
                            Comp {a.comp ?? 0}%
                          </span>
                        </div>
                      </div>
                    ))}

                    {filteredAgents.length === 0 && (
                      <div className="px-4 py-6 text-sm text-white/60">No agents.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="text-sm font-semibold mb-2">Admin</div>
              <div className="text-xs text-white/55">
                Add Agent sends an invite link to the agent’s email. They create a password and log into Flow.
              </div>
            </div>
          </div>
        )}

        {/* POSITIONS */}
        {tab === 'positions' && (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="text-sm font-semibold">Update Position</div>
            <div className="text-xs text-white/55 mt-1">
              Comp is in 5% increments. Effective date uses glass calendar.
            </div>

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

              <Field label="Comp %">
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

              <Field label="Effective Date">
                <FlowDatePicker value={pos.effective_date} onChange={(v) => setPos((p) => ({ ...p, effective_date: v }))} />
              </Field>
            </div>

            <button onClick={updatePosition} className={saveWide}>
              Save Position
            </button>
          </div>
        )}

        {/* THEMES */}
        {tab === 'themes' && (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="text-sm font-semibold">Theme (Agency Owners)</div>
            <div className="text-xs text-white/55 mt-1">
              Only agency owners can apply a theme. Downlines inherit their direct upline’s theme.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <Field label="Select Theme">
                <select className={inputCls} value={themePick} onChange={(e) => setThemePick(e.target.value)}>
                  {THEMES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="My Status">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  {me?.is_agency_owner ? 'Agency Owner ✅' : (me?.role || '').toLowerCase() === 'admin' ? 'Admin ✅' : 'Agent'}
                </div>
              </Field>
            </div>

            <button onClick={saveTheme} className={saveWide}>
              Save Theme
            </button>
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
                <div className="text-xs text-white/55 mt-1">Invite to their own login (email).</div>
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

              <Field label="Upline (live agents)">
                <select className={inputCls} value={invite.upline_id} onChange={(e) => setInvite((p) => ({ ...p, upline_id: e.target.value }))}>
                  <option value="">Select…</option>
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

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

const closeBtn =
  'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold'

const saveBtn =
  'rounded-2xl bg-green-600 hover:bg-green-500 transition px-5 py-3 text-sm font-semibold'

const saveWide =
  'mt-5 w-full rounded-2xl bg-green-600 hover:bg-green-500 transition px-4 py-3 text-sm font-semibold'

const logoutBtn =
  'rounded-2xl border border-red-400/30 bg-red-500/10 hover:bg-red-500/15 transition px-4 py-2 text-sm font-semibold text-red-200'
