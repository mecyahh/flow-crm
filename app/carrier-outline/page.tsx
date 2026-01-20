'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Carrier = {
  id: string
  name: string
  sort_order: number | null
  active: boolean | null
  eapp_url: string | null
  portal_url: string | null
  support_phone: string | null
}

type Account = {
  id: string
  agent_id: string
  carrier_id: string
  producer_number: string | null
  username: string | null
  password: string | null
  status: 'active' | 'pending' | 'inactive' | string
  updated_at: string
}

type Licenses = {
  agent_id: string
  npn: string | null
  resident_license: string | null
  florida_license: string | null
}

// ✅ FALLBACK LINKS (if DB fields are null)
const CARRIER_FALLBACKS: Record<string, { eapp_url: string; portal_url: string; support_phone: string }> = {
  Aetna: {
    eapp_url:
      'https://www.aetna.com/aimmanageaccount/login?identityTransaction=t13%2Ba1aJXqkNmE71XgKjOqjV36ynh%2FoXVgtzAfDFlZSv8UHvqfKyV%2FHC5MFnx%2B%2F9oGOoUr8fJYaTxzLNDRU8AeTUMwDdO802qgyvz8XeOlaVL1I5jUg2Tv1f0%2FG4qdYf%2F6kYfN0O1kttxLLCnWCFsIvEGkcxNqHX%2BEbcbyydLwMM2eNb2JyxeUCK3mVaDrBzqQnEL8wDWUPUsnuJg9bzZBQVK4NhZUahh9H6Nnp%2B4wF3c5HWvBoTUwZEaCGgvKkmiKUplTTrxC2FVjDf8RnuwfuPG4CrlaETukIZDeoMj7Kvewx%2BbnLQye55QI7Yk1oXVCokQZcwL1%2BaKHnuCJoNK%2FK5DceKwfp%2FPtuCH6Uq%2FLQIqAJVRcDsCChEPIzFJPqYiUkAf8xfer9fFNrf2GasjrRW%2Bdg9pK2qeEbtUUL5FTDEwkDFlybpxYV%2FG%2BSX44cb3MnVXkgLQ4%2BnfSMp7uvruLcQnQmeuhx4oAXvCJLILltNOy1dL%2Fz0GgmvVcYgqn3pEcqO%2B0dKe4sQpq0IPPIlXJV2lkDLw%2BEQvxoqxz6KxUdMaTzTMMmmeRWzJAd18I5X1g4zHO21bSFlT%2BHWURyoh45%2FPgYZNwLjpBq2VTyf2QY9OIEwpoSt1QsPziGxjpGHVLmyDtEYdhc1Y8TNt2JjEQ%3D%3D&appname=SSIBroker&branding=aetna&skin=&language=&channel=web&psuid=&biometric_text=&businessdata=channel~aetna|subchannel~broker&business_event=Login',
    portal_url:
      'https://www.aetna.com/aimmanageaccount/login?identityTransaction=t13%2Ba1aJXqkNmE71XgKjOqjV36ynh%2FoXVgtzAfDFlZSv8UHvqfKyV%2FHC5MFnx%2B%2F9oGOoUr8fJYaTxzLNDRU8AeTUMwDdO802qgyvz8XeOlaVL1I5jUg2Tv1f0%2FG4qdYf%2F6kYfN0O1kttxLLCnWCFsIvEGkcxNqHX%2BEbcbyydLwMM2eNb2JyxeUCK3mVaDrBzqQnEL8wDWUPUsnuJg9bzZBQVK4NhZUahh9H6Nnp%2B4wF3c5HWvBoTUwZEaCGgvKkmiKUplTTrxC2FVjDf8RnuwfuPG4CrlaETukIZDeoMj7Kvewx%2BbnLQye55QI7Yk1oXVCokQZcwL1%2BaKHnuCJoNK%2FK5DceKwfp%2FPtuCH6Uq%2FLQIqAJVRcDsCChEPIzFJPqYiUkAf8xfer9fFNrf2GasjrRW%2Bdg9pK2qeEbtUUL5FTDEwkDFlybpxYV%2FG%2BSX44cb3MnVXkgLQ4%2BnfSMp7uvruLcQnQmeuhx4oAXvCJLILltNOy1dL%2Fz0GgmvVcYgqn3pEcqO%2B0dKe4sQpq0IPPIlXJV2lkDLw%2BEQvxoqxz6KxUdMaTzTMMmmeRWzJAd18I5X1g4zHO21bSFlT%2BHWURyoh45%2FPgYZNwLjpBq2VTyf2QY9OIEwpoSt1QsPziGxjpGHVLmyDtEYdhc1Y8TNt2JjEQ%3D%3D&appname=SSIBroker&branding=aetna&skin=&language=&channel=web&psuid=&biometric_text=&businessdata=channel~aetna|subchannel~broker&business_event=Login',
    support_phone: '(866) 272-6630',
  },
  Aflac: {
    eapp_url:
      'https://www.aetnaseniorproducts.com/ssibrokerwebsecure/afl/login.fcc?TYPE=33554433&REALMOID=06-ff4bb4c5-301d-4181-bd7a-b75398c8cb44&GUID=&SMAUTHREASON=0&METHOD=GET&SMAGENTNAME=-SM-s7pFJAUCnH5Qp3pzu1lx8MibbZnWT%2b01G%2f6iCkHVxMsS0hd%2fsbmjhWe16MOGqvFRrS17O3IrRUBJqyBYHEvE5IyHDS9KZnck&TARGET=-SM-HTTPS%3a%2f%2fwww%2eaetnaseniorproducts%2ecom%2fssibrokerwebsecure%2fafl%2fhome%2ehtml',
    portal_url:
      'https://www.aetnaseniorproducts.com/ssibrokerwebsecure/afl/login.fcc?TYPE=33554433&REALMOID=06-ff4bb4c5-301d-4181-bd7a-b75398c8cb44&GUID=&SMAUTHREASON=0&METHOD=GET&SMAGENTNAME=-SM-s7pFJAUCnH5Qp3pzu1lx8MibbZnWT%2b01G%2f6iCkHVxMsS0hd%2fsbmjhWe16MOGqvFRrS17O3IrRUBJqyBYHEvE5IyHDS9KZnck&TARGET=-SM-HTTPS%3a%2f%2fwww%2eaetnaseniorproducts%2ecom%2fssibrokerwebsecure%2fafl%2fhome%2ehtml',
    support_phone: '(833) 504-0336',
  },
  Transamerica: {
    eapp_url: 'https://secure.transamerica.com/login/sign-in/login.html?TAM_OP=login',
    portal_url: 'https://secure.transamerica.com/login/sign-in/login.html?TAM_OP=login',
    support_phone: '(800) 797-2643',
  },
  'American Amicable': {
    eapp_url: 'https://www.insuranceapplication.com/AppPage/index.html',
    portal_url: 'https://www.americanamicable.com/v4/AgentLogin.php',
    support_phone: '(800) 736-7311',
  },
  'Mutual of Omaha': {
    eapp_url: 'https://accounts.mutualofomaha.com/samlAuthnRequest',
    portal_url: 'https://accounts.mutualofomaha.com/samlAuthnRequest',
    support_phone: '(800) 693-6083',
  },
  'Royal Neighbors': {
    eapp_url: 'https://agent.royalneighbors.org/login',
    portal_url: 'https://agent.royalneighbors.org/login',
    support_phone: '(800) 770-4561',
  },
}

function pickFallback(name: string) {
  const key = name.trim()
  return CARRIER_FALLBACKS[key] || null
}

export default function CarrierOutlinePage() {
  const [loading, setLoading] = useState(true)
  const [savingCarrier, setSavingCarrier] = useState<string | null>(null)
  const [savingLicenses, setSavingLicenses] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [accounts, setAccounts] = useState<Record<string, Account>>({})
  const [search, setSearch] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)

  // licenses
  const [npn, setNpn] = useState('')
  const [residentLicense, setResidentLicense] = useState('')
  const [floridaLicense, setFloridaLicense] = useState('')

  // per-carrier drafts
  const [draft, setDraft] = useState<
    Record<
      string,
      {
        producer_number: string
        username: string
        password: string
        status: 'active' | 'pending' | 'inactive'
      }
    >
  >({})

  useEffect(() => {
    let alive = true
    ;(async () => {
      await load(alive)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load(alive = true) {
    try {
      setLoading(true)
      setToast(null)

      const userRes = await supabase.auth.getUser()
      const uid = userRes.data.user?.id
      if (!uid) {
        setLoading(false)
        window.location.href = '/login'
        return
      }

      const cRes = await supabase
        .from('carriers')
        .select('id, name, sort_order, active, eapp_url, portal_url, support_phone')
        .eq('active', true)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true })

      if (cRes.error) throw new Error(`Could not load carriers: ${cRes.error.message}`)

      const aRes = await supabase
        .from('agent_carrier_accounts')
        .select('id, agent_id, carrier_id, producer_number, username, password, status, updated_at')
        .eq('agent_id', uid)

      if (aRes.error) throw new Error(`Could not load your carrier accounts (RLS): ${aRes.error.message}`)

      const lRes = await supabase
        .from('agent_licenses')
        .select('agent_id, npn, resident_license, florida_license')
        .eq('agent_id', uid)
        .maybeSingle()

      if (!lRes.error && lRes.data) {
        const l = lRes.data as Licenses
        setNpn(l.npn || '')
        setResidentLicense(l.resident_license || '')
        setFloridaLicense(l.florida_license || '')
      }

      const carrierList = (cRes.data || []) as Carrier[]
      const accList = (aRes.data || []) as Account[]

      const accMap: Record<string, Account> = {}
      for (const a of accList) accMap[a.carrier_id] = a

      const d: typeof draft = {}
      for (const c of carrierList) {
        const existing = accMap[c.id]
        d[c.id] = {
          producer_number: existing?.producer_number || '',
          username: existing?.username || '',
          password: existing?.password || '',
          status: (existing?.status as any) || 'active',
        }
      }

      if (!alive) return
      setCarriers(carrierList)
      setAccounts(accMap)
      setDraft(d)
    } catch (e: any) {
      setToast(e?.message || 'Load failed')
      setCarriers([])
      setAccounts({})
      setDraft({})
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return carriers
    return carriers.filter((c) => (c.name || '').toLowerCase().includes(q))
  }, [carriers, search])

  function setField(carrierId: string, field: keyof (typeof draft)[string], value: any) {
    setDraft((prev) => ({
      ...prev,
      [carrierId]: { ...prev[carrierId], [field]: value },
    }))
  }

  async function saveLicenses() {
    setSavingLicenses(true)
    try {
      const userRes = await supabase.auth.getUser()
      const uid = userRes.data.user?.id
      if (!uid) {
        setSavingLicenses(false)
        window.location.href = '/login'
        return
      }

      const payload = {
        agent_id: uid,
        npn: npn.trim() || null,
        resident_license: residentLicense.trim() || null,
        florida_license: floridaLicense.trim() || null,
      }

      const res = await supabase.from('agent_licenses').upsert(payload, { onConflict: 'agent_id' })
      if (res.error) throw new Error(res.error.message)

      setToast('Saved ✅')
    } catch (e: any) {
      setToast(e?.message || 'Could not save licenses')
    } finally {
      setSavingLicenses(false)
    }
  }

  async function saveCarrier(carrierId: string) {
    setSavingCarrier(carrierId)

    try {
      const userRes = await supabase.auth.getUser()
      const uid = userRes.data.user?.id
      if (!uid) {
        setSavingCarrier(null)
        window.location.href = '/login'
        return
      }

      const d = draft[carrierId]
      const payload = {
        agent_id: uid,
        carrier_id: carrierId,
        producer_number: d.producer_number.trim() || null,
        username: d.username.trim() || null,
        password: d.password.trim() || null,
        status: d.status,
      }

      const existing = accounts[carrierId]
      const res = existing?.id
        ? await supabase.from('agent_carrier_accounts').update(payload).eq('id', existing.id)
        : await supabase.from('agent_carrier_accounts').insert(payload)

      if (res.error) throw new Error(res.error.message)

      setToast('Saved ✅')
      await load(true)
    } catch (e: any) {
      setToast(e?.message || 'Save failed')
    } finally {
      setSavingCarrier(null)
    }
  }

  async function clearCarrier(carrierId: string) {
    try {
      const existing = accounts[carrierId]
      if (!existing?.id) {
        setField(carrierId, 'producer_number', '')
        setField(carrierId, 'username', '')
        setField(carrierId, 'password', '')
        setField(carrierId, 'status', 'active')
        return
      }

      const res = await supabase.from('agent_carrier_accounts').delete().eq('id', existing.id)
      if (res.error) throw new Error(res.error.message)

      setToast('Cleared ✅')
      await load(true)
    } catch (e: any) {
      setToast(e?.message || 'Clear failed')
    }
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
            <h1 className="text-3xl font-semibold tracking-tight">Carrier Outline</h1>
            <p className="text-sm text-[var(--muted)] mt-1">Producer numbers + logins + quick links.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="glass rounded-2xl border border-[var(--border)] px-3 py-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm6.5 1 4-4"
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <input
                className="bg-transparent outline-none text-sm w-56 placeholder:text-[var(--muted2)]"
                placeholder="Search carriers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button onClick={() => setShowPasswords((s) => !s)} className={btnGlass}>
              {showPasswords ? 'Hide Passwords' : 'Show Passwords'}
            </button>

            <button onClick={() => load(true)} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        {/* LICENSES TOP */}
        <div className="glass rounded-2xl border border-[var(--border)] p-6 mb-6">
          <div className="text-sm font-semibold mb-4">Licenses</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="National Producer Number">
              <input className={inputCls} value={npn} onChange={(e) => setNpn(e.target.value)} placeholder="NPN" />
            </Field>
            <Field label="Resident License Number">
              <input
                className={inputCls}
                value={residentLicense}
                onChange={(e) => setResidentLicense(e.target.value)}
                placeholder="Resident License"
              />
            </Field>
            <Field label="Florida License Number">
              <input
                className={inputCls}
                value={floridaLicense}
                onChange={(e) => setFloridaLicense(e.target.value)}
                placeholder="FL License"
              />
            </Field>
          </div>

          <button onClick={saveLicenses} disabled={savingLicenses} className={saveBtnWide}>
            {savingLicenses ? 'Saving…' : 'Save Licenses'}
          </button>
        </div>

        {loading && <div className="text-[var(--muted)]">Loading…</div>}

        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filtered.map((c) => {
              const d = draft[c.id]
              const has = !!accounts[c.id]
              const isSaving = savingCarrier === c.id

              const fb = pickFallback(c.name)
              const eapp = (c.eapp_url || fb?.eapp_url || null) as string | null
              const portal = (c.portal_url || fb?.portal_url || null) as string | null
              const phone = (c.support_phone || fb?.support_phone || null) as string | null

              return (
                <div key={c.id} className="glass rounded-2xl border border-[var(--border)] p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-semibold truncate">{c.name}</div>
                        <StatusPill status={d?.status || 'active'} />
                        {has && <span className="text-xs text-[var(--muted2)]">Saved</span>}
                      </div>
                      <div className="text-xs text-[var(--muted2)] mt-1">
                        Last updated: {has ? new Date(accounts[c.id].updated_at).toLocaleString() : '—'}
                      </div>
                    </div>

                    <button onClick={() => clearCarrier(c.id)} className={btnDanger}>
                      Clear
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Producer Number">
                      <input
                        className={inputCls}
                        value={d?.producer_number || ''}
                        onChange={(e) => setField(c.id, 'producer_number', e.target.value)}
                        placeholder="Producer #"
                      />
                    </Field>

                    <Field label="Status">
                      <select
                        className={inputCls}
                        value={d?.status || 'active'}
                        onChange={(e) => setField(c.id, 'status', e.target.value)}
                      >
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>

                    <Field label="Username">
                      <input
                        className={inputCls}
                        value={d?.username || ''}
                        onChange={(e) => setField(c.id, 'username', e.target.value)}
                        placeholder="Username"
                      />
                    </Field>

                    <Field label="Password">
                      <input
                        className={inputCls}
                        value={d?.password || ''}
                        onChange={(e) => setField(c.id, 'password', e.target.value)}
                        placeholder="Password"
                        type={showPasswords ? 'text' : 'password'}
                      />
                    </Field>
                  </div>

                  {/* E-App | Agent Portal, Phone below */}
                  <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--panel2)] p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <LinkCard label="E-App" href={eapp} />
                      <LinkCard label="Agent Portal" href={portal} />
                    </div>
                    <div className="mt-3 text-center text-sm text-[var(--text)]">{phone ? phone : '—'}</div>
                  </div>

                  <button onClick={() => saveCarrier(c.id)} disabled={isSaving} className={saveBtnWide}>
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- UI bits ---------- */

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className || ''}>
      <div className="text-[11px] text-[var(--muted)] mb-2">{label}</div>
      {children}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-green-500/12 border-green-400/25 text-green-200'
      : status === 'pending'
      ? 'bg-yellow-500/12 border-yellow-400/25 text-yellow-200'
      : 'bg-white/6 border-white/12 text-white/70'
  return <span className={`text-[11px] px-2 py-1 rounded-xl border ${cls}`}>{status}</span>
}

function LinkCard({ label, href }: { label: string; href: string | null }) {
  const disabled = !href
  return (
    <a
      href={href || '#'}
      target="_blank"
      rel="noreferrer"
      className={[
        'rounded-2xl border px-4 py-3 text-sm font-semibold transition flex items-center justify-between',
        disabled
          ? 'border-[var(--border)] bg-[var(--panel2)] text-[var(--muted2)] pointer-events-none'
          : 'border-[var(--border)] bg-[var(--panel2)] hover:bg-[var(--panel)] text-[var(--text)]',
      ].join(' ')}
    >
      <span>{label}</span>
      <span className="text-xs opacity-60">↗</span>
    </a>
  )
}

const inputCls =
  'w-full rounded-2xl border border-[var(--border)] bg-[var(--panel2)] px-4 py-3 text-sm outline-none text-[var(--text)] focus:border-[var(--border2)] focus:bg-[var(--panel)] placeholder:text-[var(--muted2)]'

const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-[var(--panel)] transition rounded-2xl border border-[var(--border)] text-[var(--text)]'

const btnSoft =
  'rounded-xl bg-[var(--panel2)] hover:bg-[var(--panel)] transition px-3 py-2 text-xs border border-[var(--border)] text-[var(--text)]'

const btnDanger =
  'rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs hover:bg-red-500/15 transition text-[var(--text)]'

const saveBtnWide =
  'mt-5 w-full rounded-2xl bg-[var(--accent)] hover:opacity-90 transition px-4 py-3 text-sm font-semibold text-[var(--accentText)] disabled:opacity-50'
