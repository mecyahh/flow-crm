// ✅ REPLACE ENTIRE FILE: /app/post-deal/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import GlassSelect, { GlassOption } from '@/app/components/GlassSelect'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type CarrierRow = {
  id: string
  name: string
  supported_name: string | null
  active: boolean | null
  sort_order: number | null
}

type ProductRow = {
  id: string
  carrier_id: string
  product_name: string
  sort_order: number | null
  is_active: boolean | null
}

type SourceOpt = 'Inbound' | 'Readymode' | 'Referral' | 'Warm-Market'

export default function PostDealPage() {
  const router = useRouter()

  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [carriers, setCarriers] = useState<CarrierRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])

  // Form (LOCKED FIELDS)
  const [full_name, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('') // YYYY-MM-DD
  const [effective_date, setEffectiveDate] = useState('') // YYYY-MM-DD

  // ✅ Typeable (MM/DD/YYYY) in addition to FlowDatePicker
  const [dobText, setDobText] = useState('') // MM/DD/YYYY
  const [effText, setEffText] = useState('') // MM/DD/YYYY

  const [carrier_id, setCarrierId] = useState('')
  const [company, setCompany] = useState('') // deals.company
  const [product_name, setProductName] = useState('')

  const [coverage, setCoverage] = useState('')
  const [premium, setPremium] = useState('')
  const [policy_number, setPolicyNumber] = useState('')

  // ✅ NEW FIELDS
  const [referrals_collected, setReferralsCollected] = useState('0') // editable any number
  const [source, setSource] = useState<SourceOpt>('Inbound')

  // ✅ Confetti overlay (MORE)
  const [confettiOn, setConfettiOn] = useState(false)
  const confettiKeyRef = useRef(0)

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!carrier_id) {
      setProducts([])
      setProductName('')
      return
    }
    loadProducts(carrier_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrier_id])

  // ✅ Keep typeable text synced from ISO values
  useEffect(() => {
    setDobText(dob ? isoToMDY(dob) : '')
  }, [dob])

  useEffect(() => {
    setEffText(effective_date ? isoToMDY(effective_date) : '')
  }, [effective_date])

  async function boot() {
    setLoading(true)

    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id
    if (!uid) {
      window.location.href = '/login'
      return
    }

    const { data, error } = await supabase
      .from('carriers')
      .select('id,name,supported_name,active,sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(5000)

    if (error) {
      setToast(`Could not load carriers: ${error.message}`)
      setCarriers([])
      setLoading(false)
      return
    }

    const activeOnly = ((data || []) as CarrierRow[]).filter((c) => c.active !== false)
    setCarriers(activeOnly)
    setLoading(false)
  }

  async function loadProducts(cid: string) {
    const { data, error } = await supabase
      .from('carrier_products')
      .select('id,carrier_id,product_name,sort_order,is_active')
      .eq('carrier_id', cid)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(5000)

    if (error) {
      setToast(`Could not load products: ${error.message}`)
      setProducts([])
      return
    }

    const activeOnly = ((data || []) as ProductRow[]).filter((p) => p.is_active !== false)
    setProducts(activeOnly)
  }

  const carrierOptions = useMemo(() => {
    return carriers.map((c) => ({
      id: c.id,
      label: c.name,
      supported_name: c.supported_name || c.name,
    }))
  }, [carriers])

  const productOptions = useMemo(() => {
    return products.map((p) => ({
      id: p.id,
      label: p.product_name,
    }))
  }, [products])

  async function fireDiscordWebhook(dealId: string) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return

    await fetch('/api/webhooks/deal-posted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ deal_id: dealId }),
    }).catch(() => {})
  }

  async function submit() {
    if (saving) return
    setToast(null)

    const nameClean = full_name.trim()
    if (!nameClean) return setToast('Client name is required')

    if (!company.trim()) return setToast('Select a carrier')
    if (!product_name.trim()) return setToast('Select a product')

    const premNum = toMoneyNumber(premium)
    if (!Number.isFinite(premNum) || premNum <= 0) return setToast('Premium is required')

    const covNum = coverage ? toMoneyNumber(coverage) : null
    if (coverage && (!Number.isFinite(covNum as any) || (covNum as any) <= 0))
      return setToast('Coverage must be a valid number')

    // ✅ Policy number lock: at least 6 chars (if provided)
    const pol = policy_number.trim()
    if (pol && pol.length < 6) return setToast('Policy # must be at least 6 characters')

    // ✅ Referrals collected: numeric, >= 0 (editable any number)
    const refs = parseIntInput(referrals_collected)
    if (!Number.isFinite(refs) || refs < 0) return setToast('Referrals collected must be 0 or more')

    // ✅ Phone uniqueness lock (prevent double-entry)
    const phoneDigits = normalizePhoneDigits(phone)
    if (phoneDigits && phoneDigits.length !== 10) return setToast('Phone must be 10 digits')
    if (phoneDigits && phoneDigits.length === 10) {
      const dup = await phoneAlreadyUsed(phoneDigits, phone)
      if (dup) return setToast('That phone number is already in the system. This client is locked.')
    }

    setSaving(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id
      if (!uid) {
        window.location.href = '/login'
        return
      }

            const payload: any = {
  agent_id: uid,
  user_id: uid,
  full_name: nameClean,
  phone: phoneDigits ? phoneDigits : null,
  dob: dob || null,
  company: company.trim(),
  policy_number: pol || null,
  coverage: covNum,
  premium: premNum,
  status: 'submitted',

  source: source, // ✅ THIS makes the donut show it

  note: buildNote({
    product_name,
    effective_date,
    referrals_collected: refs,
    source,
  }),
}

      const { data: inserted, error } = await supabase.from('deals').insert(payload).select('id').single()
      if (error) throw new Error(error.message)

      if (inserted?.id) fireDiscordWebhook(inserted.id)

      triggerConfetti()

      // ✅ let the confetti play longer before navigating
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1800)
    } catch (e: any) {
      setToast(e?.message || 'Submit failed')
      setSaving(false)
      return
    }
  }

  async function phoneAlreadyUsed(phoneDigits: string, formatted: string) {
    // check both normalized + formatted to catch older rows
    // (older rows may have been stored as "(888) 888-8888")
    const formattedClean = String(formatted || '').trim()
    const { data, error } = await supabase
      .from('deals')
      .select('id')
      .or(`phone.eq.${escapeOr(phoneDigits)},phone.eq.${escapeOr(formattedClean)}`)
      .limit(1)

    if (error) return false // don’t block if query fails
    return !!(data && data.length > 0)
  }

  function escapeOr(v: string) {
    // very small safety for `.or()` string
    return String(v || '').replace(/,/g, '').replace(/\)/g, '').replace(/\(/g, '').replace(/"/g, '')
  }

  function triggerConfetti() {
    confettiKeyRef.current += 1
    setConfettiOn(true)
    window.setTimeout(() => setConfettiOn(false), 2600)
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      
      {confettiOn && <ConfettiBurst key={confettiKeyRef.current} durationMs={2600} />}

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
            <h1 className="text-3xl font-semibold tracking-tight">Post a Deal</h1>
            <p className="text-sm text-white/60 mt-1">Great Job ! Once You Post Your Deal, Go Get Another One!</p>
          </div>

          <button onClick={() => router.push('/dashboard')} className={btnGlass}>
            Back to Dashboard
          </button>
        </div>

        <div className="glass rounded-2xl border border-white/10 p-6">
          {loading ? (
            <div className="px-6 py-10 text-center text-white/60">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="max-w-2xl">
                <div className="space-y-4">
                  <Field label="Client Name">
                    <input className={inputCls} value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Client name" />
                  </Field>

                  <Field label="Phone Number">
  <input
    className={inputCls}
    value={phone}
    onChange={(e) => setPhone(formatPhone(e.target.value))}
    placeholder="(888) 888-8888"
    inputMode="tel"
  />
</Field>

                  {/* ✅ DOB + Effective now have TYPEABLE MM/DD/YYYY + FlowDatePicker */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="DOB">
                      <div className="space-y-2">
                        <input
                          className={inputCls}
                          value={dobText}
                          onChange={(e) => setDobText(lockMDY(e.target.value))}
                          onBlur={() => {
                            if (!dobText.trim()) return setDob('')
                            const iso = mdyToISO(dobText)
                            if (!iso) return setToast('DOB must be MM/DD/YYYY')
                            setDob(iso)
                          }}
                          placeholder="MM/DD/YYYY"
                          inputMode="numeric"
                        />
                        <FlowDatePicker
                          value={dob}
                          onChange={(v) => {
                            setDob(v)
                            setDobText(v ? isoToMDY(v) : '')
                          }}
                          placeholder="Select DOB"
                        />
                      </div>
                    </Field>

                    <Field label="Effective Date">
                      <div className="space-y-2">
                        <input
                          className={inputCls}
                          value={effText}
                          onChange={(e) => setEffText(lockMDY(e.target.value))}
                          onBlur={() => {
                            if (!effText.trim()) return setEffectiveDate('')
                            const iso = mdyToISO(effText)
                            if (!iso) return setToast('Effective Date must be MM/DD/YYYY')
                            setEffectiveDate(iso)
                          }}
                          placeholder="MM/DD/YYYY"
                          inputMode="numeric"
                        />
                        <FlowDatePicker
                          value={effective_date}
                          onChange={(v) => {
                            setEffectiveDate(v)
                            setEffText(v ? isoToMDY(v) : '')
                          }}
                          placeholder="Select Effective Date"
                        />
                      </div>
                    </Field>
                  </div>

                  <Field label="Carrier">
  <GlassSelect
    value={carrier_id}
    onChange={(cid, opt) => {
      setCarrierId(cid)
      // use the selected label for deals.company
      setCompany(opt?.label || '')
    }}
    placeholder="Select carrier…"
    options={carrierOptions.map((c) => ({ value: c.id, label: c.label }))}
  />
</Field>

                 <Field label="Product">
  <GlassSelect
    value={product_name}
    disabled={!carrier_id}
    onChange={(v) => setProductName(v)}
    placeholder={carrier_id ? 'Select product…' : 'Select carrier first…'}
    options={productOptions.map((p) => ({ value: p.label, label: p.label }))}
  />
</Field>

                 <Field label="Source">
  <GlassSelect
    value={source}
    onChange={(v) => setSource(v as any)}
    options={[
      { value: 'Inbound', label: 'Inbound' },
      { value: 'Readymode', label: 'Readymode' },
      { value: 'Referral', label: 'Referral' },
      { value: 'Warm-Market', label: 'Warm-Market' },
    ]}
  />
</Field>

                  <Field label="Referrals Collected">
                    <input
                      className={inputCls}
                      value={referrals_collected}
                      onChange={(e) => setReferralsCollected(editableInt(e.target.value))}
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </Field>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Coverage">
                      <input
                        className={inputCls}
                        value={coverage}
                        onChange={(e) => setCoverage(moneyInput(e.target.value))}
                        onBlur={() => setCoverage(formatMoneyInput(coverage))}
                        placeholder="$100,000"
                        inputMode="decimal"
                      />
                    </Field>

                    <Field label="Premium">
                      <input
                        className={inputCls}
                        value={premium}
                        onChange={(e) => setPremium(moneyInput(e.target.value))}
                        onBlur={() => setPremium(formatMoneyInput(premium))}
                        placeholder="$100"
                        inputMode="decimal"
                      />
                    </Field>
                  </div>

                  <Field label="Policy #">
                    <input
                      className={inputCls}
                      value={policy_number}
                      onChange={(e) => setPolicyNumber(e.target.value)}
                      placeholder="Policy number"
                    />
                  </Field>
                </div>

                <button
                  onClick={submit}
                  disabled={saving}
                  className={[
                    'mt-6 w-full rounded-2xl transition px-4 py-3 text-sm font-semibold',
                    saving ? 'bg-white/10 border border-white/10 text-white/60 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500',
                  ].join(' ')}
                >
                  {saving ? 'Submitting…' : 'Submit Deal'}
                </button>
              </div>

              {/* ✅ Open Space on right-hand side (NO DATA) */}
              <div className="hidden lg:block">
                <div className="h-full rounded-2xl border border-white/10 bg-white/5 overflow-hidden relative">
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-blue-500/10 blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 w-[420px] h-[420px] rounded-full bg-white/5 blur-3xl" />
                  </div>
                  {/* intentionally empty */}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
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

function normalizePhoneDigits(input: string) {
  return String(input || '').replace(/\D/g, '').slice(0, 10)
}

function formatPhone(input: string) {
  const digits = normalizePhoneDigits(input)
  if (digits.length === 0) return ''
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function moneyInput(v: string) {
  const cleaned = String(v || '').replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
}

function editableInt(v: string) {
  const s = String(v || '').replace(/[^0-9]/g, '')
  return s
}

function parseIntInput(v: string) {
  const s = String(v || '').trim()
  if (s === '') return 0
  const n = Number(s.replace(/[^0-9]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

function toMoneyNumber(v: string) {
  const num = Number(String(v || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(num) ? num : NaN
}

function formatMoneyInput(v: string) {
  const n = toMoneyNumber(v)
  if (!Number.isFinite(n)) return ''

  return `$${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/* ---------- Typeable dates (MM/DD/YYYY) <-> ISO (YYYY-MM-DD) ---------- */

function lockMDY(v: string) {
  // allow only digits + slash, auto-insert slashes as user types
  const digits = String(v || '').replace(/[^\d]/g, '').slice(0, 8) // MMDDYYYY
  const mm = digits.slice(0, 2)
  const dd = digits.slice(2, 4)
  const yy = digits.slice(4, 8)
  let out = mm
  if (dd) out += '/' + dd
  if (yy) out += '/' + yy
  return out
}

function mdyToISO(mdy: string) {
  const m = String(mdy || '').trim()
  const parts = m.split('/')
  if (parts.length !== 3) return null
  const mm = Number(parts[0])
  const dd = Number(parts[1])
  const yyyy = Number(parts[2])
  if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yyyy)) return null
  if (yyyy < 1900 || yyyy > 2100) return null
  if (mm < 1 || mm > 12) return null
  if (dd < 1 || dd > 31) return null
  const dt = new Date(yyyy, mm - 1, dd)
  // validate real date (e.g. 02/31)
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null
  const y = String(yyyy)
  const mo = String(mm).padStart(2, '0')
  const da = String(dd).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function isoToMDY(iso: string) {
  const s = String(iso || '').trim()
  const [y, m, d] = s.split('-').map((x) => Number(x))
  if (!y || !m || !d) return ''
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${String(y).padStart(4, '0')}`
}

function buildNote({
  product_name,
  effective_date,
  referrals_collected,
  source,
}: {
  product_name: string
  effective_date: string
  referrals_collected: number
  source: string
}) {
  // ✅ This is the key to making ALL Discord posts consistent:
  // webhook reads product from `product_name:` or `Product:`
  // and strips `Effective:` but leaves Source/Referrals in the same line.
  const parts: string[] = []
  const core = [
    `product_name: ${product_name}`.trim(),
    `Source: ${source}`.trim(),
    `Referrals: ${referrals_collected}`.trim(),
  ]
    .filter(Boolean)
    .join(' | ')

  parts.push(core)
  if (effective_date) parts.push(`Effective: ${effective_date}`)
  return parts.join(' | ')
}

function ConfettiBurst({ durationMs = 2600 }: { durationMs?: number }) {
  const pieces = useMemo(() => {
    const out: { left: number; delay: number; dur: number; rot: number; size: number; hue: number; drift: number }[] = []
    const COUNT = 240 // ✅ MORE confetti
    for (let i = 0; i < COUNT; i++) {
      out.push({
        left: Math.random() * 100,
        delay: Math.random() * 0.25,
        dur: durationMs / 1000 - 0.2 + Math.random() * 0.9,
        rot: Math.random() * 360,
        size: 6 + Math.random() * 14,
        hue: Math.floor(Math.random() * 360),
        drift: (Math.random() - 0.5) * 140, // left/right drift
      })
    }
    return out
  }, [durationMs])

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-16px] rounded-sm opacity-95"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${Math.max(6, p.size * 0.6)}px`,
            background: `hsla(${p.hue}, 92%, 62%, 0.95)`,
            transform: `rotate(${p.rot}deg)`,
            animation: `confettiFall ${p.dur}s cubic-bezier(.1,.8,.2,1) ${p.delay}s forwards`,
            ['--drift' as any]: `${p.drift}px`,
          }}
        />
      ))}

      <style jsx>{`
        @keyframes confettiFall {
          0% {
            transform: translate3d(0, -10px, 0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--drift), 115vh, 0) rotate(980deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7 text-white placeholder:text-white/45'

const selectCls =
  'w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white text-black'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
