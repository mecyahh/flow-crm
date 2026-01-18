// ✅ FILE: /app/settings/page.tsx  (REPLACE ENTIRE FILE)
// Adds: Admin-only "Agents" tab + Add Agent modal (calls /api/admin/invite)

'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role: string // agent | admin
  is_agency_owner: boolean
  comp: number
  upline_id: string | null
  theme: string | null
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

export default function SettingsPage() {
  const [me, setMe] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [tab, setTab] = useState<'profile' | 'agents'>('profile')

  // profile edit
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  // agents tab
  const [agents, setAgents] = useState<Profile[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [agentSearch, setAgentSearch] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)

  const [invite, setInvite] = useState({
    first_name: '',
    last_name: '',
    email: '',
    upline_id: '',
    comp: 0,
    is_agency_owner: false,
    theme: 'blue',
    role: 'agent',
  })

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setLoading(true)

    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof) {
      setLoading(false)
      return
    }

    const p = prof as Profile
    setMe(p)

    setFirstName(p.first_name || '')
    setLastName(p.last_name || '')
    setEmail(p.email || '')

    // Admins default into Agents tab
    if (p.role === 'admin' || p.is_agency_owner) {
      setTab('agents')
      loadAgents()
    } else {
      setTab('profile')
    }

    setLoading(false)
  }

  async function loadAgents() {
    setAgentsLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) setToast('Could not load agents')
    setAgents((data || []) as Profile[])
    setAgentsLoading(false)
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

  async function saveProfile() {
    if (!me) return

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
      })
      .eq('id', me.id)

    if (error) {
      setToast('Save failed')
      return
    }

    setToast('Profile updated ✅')
    boot()
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function inviteAgent() {
    if (!me) return
    if (!(me.role === 'admin' || me.is_agency_owner)) {
      setToast('Admin only')
      return
    }

    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...invite,
        upline_id: invite.upline_id || null,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      setToast(json.error || 'Invite failed')
      return
    }

    setToast('Invite sent ✅')
    setInviteOpen(false)
    setInvite({
      first_name: '',
      last_name: '',
      email: '',
      upline_id: '',
      comp: 0,
      is_agency_owner: false,
      theme: 'blue',
      role: 'agent',
    })
    loadAgents()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] text-white flex items-center justify-center">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl px-5 py-4 shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <button onClick={() => setToast(null)} className="mt-3 text-xs text-white/70 hover:text-white">
              OK
            </button>
          </div>
        </div>
      )}

      <div className="ml-64 px-10 py-10 max-w-5xl">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Settings</h1>
            <p className="text-sm text-white/60">Profile + agent invites.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setTab('profile')}
              className={[
                'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                tab === 'profile' ? 'bg-white/10 border-white/15' : 'bg-white/5 border-white/10 hover:bg-white/10',
              ].join(' ')}
            >
              Profile
            </button>

            {(me?.role === 'admin' || me?.is_agency_owner) && (
              <button
                onClick={() => {
                  setTab('agents')
                  loadAgents()
                }}
                className={[
                  'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                  tab === 'agents' ? 'bg-white/10 border-white/15' : 'bg-white/5 border-white/10 hover:bg-white/10',
                ].join(' ')}
              >
                Agents
              </button>
            )}
          </div>
        </div>

        {/* PROFILE */}
        {tab === 'profile' && (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Profile</h2>

              <Field label="Profile Picture">
                {me?.avatar_url && (
                  <img
                    src={me.avatar_url}
                    alt="Avatar"
                    className="h-16 w-16 rounded-full mb-3 object-cover border border-white/10"
                  />
                )}

                <input
                  type="file"
                  accept="image/*"
                  className="block w-full text-sm text-white/70
                    file:mr-4 file:rounded-xl file:border-0
                    file:bg-white/10 file:px-4 file:py-2
                    file:text-sm file:font-semibold
                    hover:file:bg-white/20 transition"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file || !me) return

                    const ext = file.name.split('.').pop() || 'png'
                    const path = `${me.id}.${ext}`

                    const { error: uploadError } = await supabase.storage
                      .from('avatars')
                      .upload(path, file, { upsert: true })

                    if (uploadError) {
                      setToast('Upload failed')
                      return
                    }

                    const { data } = supabase.storage.from('avatars').getPublicUrl(path)

                    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', me.id)

                    setToast('Profile picture updated ✅')
                    boot()
                  }}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <Field label="First Name">
                  <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </Field>

                <Field label="Last Name">
                  <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </Field>

                <Field label="Email">
                  <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>

                <Field label="Role">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                    {me?.is_agency_owner ? 'Agency Owner ✅' : me?.role === 'admin' ? 'Admin ✅' : 'Agent'}
                  </div>
                </Field>
              </div>

              <button onClick={saveProfile} className={saveBtn}>
                Save Profile
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold mb-4">Account</h2>
              <button onClick={logout} className={logoutBtn}>
                Log Out
              </button>
            </div>
          </>
        )}

        {/* AGENTS */}
        {tab === 'agents' && (me?.role === 'admin' || me?.is_agency_owner) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold">Agents</div>
                  <div className="text-xs text-white/55 mt-1">Invite agents (unique login) + store comp/upline/theme.</div>
                </div>

                <button onClick={() => setInviteOpen(true)} className={saveBtnSmall}>
                  Add Agent
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 mb-4">
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

                {agentsLoading && <div className="px-4 py-6 text-sm text-white/60">Loading…</div>}

                {!agentsLoading && (
                  <div className="max-h-[520px] overflow-auto">
                    {filteredAgents.map((a) => (
                      <div key={a.id} className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">
                            {(a.first_name || '—')} {(a.last_name || '')}
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
                          <div className="text-xs text-white/55 mt-1">{a.email || '—'}</div>
                        </div>

                        <div className="text-xs text-white/65 flex gap-2">
                          <span className="px-2 py-1 rounded-xl border border-white/10 bg-white/5">
                            Comp {Number(a.comp || 0)}%
                          </span>
                          <span className="px-2 py-1 rounded-xl border border-white/10 bg-white/5">
                            Theme {(a.theme || 'blue').toUpperCase()}
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

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold mb-2">How it works</div>
              <div className="text-xs text-white/55 leading-relaxed">
                “Add Agent” sends an invite email from Supabase. The agent sets their password and logs into Flow. Their
                profile row is created/updated with comp, theme, and upline so it sticks permanently.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* INVITE MODAL */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl p-6 w-full max-w-3xl shadow-2xl">
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

              <Field label="Upline (live agents)">
                <select
                  className={inputCls}
                  value={invite.upline_id}
                  onChange={(e) => setInvite((p) => ({ ...p, upline_id: e.target.value }))}
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
                  value={invite.comp}
                  onChange={(e) => setInvite((p) => ({ ...p, comp: Number(e.target.value) }))}
                >
                  {COMP_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {v}%
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Role">
                <select
                  className={inputCls}
                  value={invite.role}
                  onChange={(e) => setInvite((p) => ({ ...p, role: e.target.value }))}
                >
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
              </Field>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setInviteOpen(false)} className={closeBtn}>
                Cancel
              </button>
              <button onClick={inviteAgent} className={saveBtnSmall}>
                Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- UI Helpers ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/10'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

const closeBtn =
  'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold'

const saveBtn =
  'mt-6 rounded-2xl bg-green-600 hover:bg-green-500 transition px-5 py-3 text-sm font-semibold'

const saveBtnSmall =
  'rounded-2xl bg-green-600 hover:bg-green-500 transition px-5 py-3 text-sm font-semibold'

const logoutBtn =
  'rounded-2xl bg-red-600/80 hover:bg-red-600 transition px-5 py-3 text-sm font-semibold'
