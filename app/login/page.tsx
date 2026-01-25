// ✅ REPLACE ENTIRE FILE: /app/login/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

function errMsg(e: any) {
  return e?.message || e?.error_description || e?.error || 'Something failed'
}

type Mode = 'login' | 'pin' | 'forgot'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')

  const [booting, setBooting] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // PIN flow
  const [pinSent, setPinSent] = useState(false)
  const [pin, setPin] = useState('') // 6 digits

  const origin = useMemo(() => (typeof window !== 'undefined' ? window.location.origin : ''), [])
  const callbackUrl = useMemo(() => `${origin}/auth/callback`, [origin])
  const resetUrl = useMemo(() => `${origin}/reset-password`, [origin])

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session?.user) {
          window.location.href = '/dashboard'
          return
        }
      } catch {
        // ignore
      } finally {
        setBooting(false)
      }
    })()
  }, [])

  const disabled = booting || busy

  async function standardLogin(e?: React.FormEvent) {
    e?.preventDefault()
    setToast(null)

    const em = email.trim()
    if (!em) return setToast('Email is required')
    if (!password) return setToast('Password is required')

    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: em, password })
      if (error) throw error
      window.location.href = '/dashboard'
    } catch (e: any) {
      setToast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function sendPin() {
    setToast(null)
    const em = email.trim()
    if (!em) return setToast('Enter your email first')

    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: em,
        options: {
          emailRedirectTo: callbackUrl,
          shouldCreateUser: false,
        },
      })
      if (error) throw error

      setPinSent(true)
      setToast('PIN sent ✅ Check your email for a 6-digit code (or link).')
    } catch (e: any) {
      setToast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function verifyPin() {
    setToast(null)
    const em = email.trim()
    const code = pin.replace(/\D/g, '').slice(0, 6)

    if (!em) return setToast('Email is required')
    if (code.length !== 6) return setToast('Enter the 6-digit PIN')

    setBusy(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: em,
        token: code,
        type: 'email',
      })
      if (error) throw error

      window.location.href = '/dashboard'
    } catch (e: any) {
      setToast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function forgotPassword() {
    setToast(null)
    const em = email.trim()
    if (!em) return setToast('Enter your email first')

    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: resetUrl,
      })
      if (error) throw error

      setToast('Reset email sent ✅ Check your inbox.')
    } catch (e: any) {
      setToast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen">
      <div className="min-h-screen bg-[#0b0f1a] text-white flex items-center justify-center px-6 py-10">
        {/* toast */}
        {toast && (
          <div className="fixed top-5 right-5 z-[999]">
            <div className="glass px-5 py-4 rounded-2xl border border-white/10 shadow-2xl max-w-[360px]">
              <div className="text-sm font-semibold">{toast}</div>
              <div className="mt-3 flex gap-2">
                <button className={btnSoft} onClick={() => setToast(null)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-[980px] grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT — marketing card (old layout) */}
          <div className="glass rounded-3xl border border-white/10 p-8 overflow-hidden relative">
            <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

            <div className="relative">
              <div className="text-xs text-white/60">Out With The Old, In With The New</div>
              <h1 className="text-3xl font-semibold tracking-tight mt-2">Flow</h1>
              <p className="text-sm text-white/60 mt-3 leading-relaxed">
                A CRM for lazy agents who want to submit business, make money, and have their book keeping and analytics automated.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Feature title="Fast tracking" desc="Post deals in seconds." />
                <Feature title="Follow ups" desc="No deals slipping." />
                <Feature title="Leaderboards" desc="Competitive output." />
                <Feature title="Analytics" desc="Clean signal." />
              </div>

              <div className="mt-8 text-xs text-white/50">By continuing you agree to your agency’s policies.</div>
            </div>
          </div>

          {/* RIGHT — auth card (old layout, new functionality) */}
          <div className="glass rounded-3xl border border-white/10 p-8">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Log in</div>
              <Link className="text-xs text-white/60 hover:underline" href="/dashboard">
                Back to dashboard
              </Link>
            </div>

            {/* Tabs: Login / PIN / Forgot */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setToast(null)
                }}
                className={[
                  tabChip,
                  mode === 'login' ? 'bg-white/10 border-white/15' : 'bg-white/5 border-white/10 hover:bg-white/10',
                ].join(' ')}
                disabled={disabled}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('pin')
                  setToast(null)
                }}
                className={[
                  tabChip,
                  mode === 'pin' ? 'bg-white/10 border-white/15' : 'bg-white/5 border-white/10 hover:bg-white/10',
                ].join(' ')}
                disabled={disabled}
              >
                PIN
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setToast(null)
                }}
                className={[
                  tabChip,
                  mode === 'forgot' ? 'bg-white/10 border-white/15' : 'bg-white/5 border-white/10 hover:bg-white/10',
                ].join(' ')}
                disabled={disabled}
              >
                Forgot
              </button>
            </div>

            {/* Shared email field (all modes) */}
            <div className="mt-6 space-y-4">
              <Field label="Email">
                <input
                  className={inputCls}
                  placeholder="name@company.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  inputMode="email"
                />
              </Field>

              {/* LOGIN */}
              {mode === 'login' && (
                <form className="space-y-4" onSubmit={standardLogin}>
                  <Field label="Password">
                    <input
                      className={inputCls}
                      placeholder="••••••••"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>

                  <button
                    disabled={disabled}
                    className={[
                      'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition border',
                      disabled ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed' : 'bg-[var(--accent)] border-white/10 hover:opacity-90',
                    ].join(' ')}
                    style={{ color: 'var(--accentText)' as any }}
                    type="submit"
                  >
                    {booting ? 'Loading…' : busy ? 'Logging in…' : 'Log in'}
                  </button>

                  <div className="flex items-center justify-between text-xs text-white/60 pt-2">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setMode('forgot')
                        setToast(null)
                      }}
                      disabled={disabled}
                    >
                      Forgot password?
                    </button>

                    <div className="flex items-center gap-2">
                      <span>Need a PIN?</span>
                      <button
                        type="button"
                        className="text-white hover:underline"
                        onClick={() => {
                          setMode('pin')
                          setToast(null)
                        }}
                        disabled={disabled}
                      >
                        PIN login
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-white/45 pt-2">
                    Trouble logging in? Verify you used the invite email and confirmed your account (if enabled).
                  </div>
                </form>
              )}

              {/* PIN */}
              {mode === 'pin' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={sendPin}
                      disabled={disabled}
                      className={[
                        'rounded-2xl border px-3 py-3 text-sm font-semibold transition',
                        disabled ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed' : 'bg-white/5 border-white/10 hover:bg-white/10',
                      ].join(' ')}
                    >
                      {busy ? 'Sending…' : pinSent ? 'Resend PIN' : 'Send PIN'}
                    </button>

                    <button
                      type="button"
                      onClick={verifyPin}
                      disabled={disabled}
                      className={[
                        'rounded-2xl px-3 py-3 text-sm font-semibold transition',
                        disabled ? 'bg-white/5 text-white/40 cursor-not-allowed border border-white/10' : 'bg-[var(--accent)] hover:opacity-90',
                      ].join(' ')}
                      style={{ color: 'var(--accentText)' as any }}
                    >
                      {busy ? 'Verifying…' : 'Verify & Login'}
                    </button>
                  </div>

                  <Field label="6 Digit PIN">
                    <input
                      className={inputCls}
                      placeholder="123456"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                  </Field>

                  <div className="text-[11px] text-white/45">
                    We’ll email you a 6-digit code. If you receive a link instead, click it — it will log you in automatically.
                  </div>

                  <div className="flex items-center justify-between text-xs text-white/60 pt-2">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setMode('login')
                        setToast(null)
                      }}
                      disabled={disabled}
                    >
                      Back to password login
                    </button>

                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setMode('forgot')
                        setToast(null)
                      }}
                      disabled={disabled}
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
              )}

              {/* FORGOT */}
              {mode === 'forgot' && (
                <div className="space-y-4">
                  <div className="text-sm text-white/70">
                    Enter your email and we’ll send a reset link that takes you to <span className="text-white font-semibold">/reset-password</span>.
                  </div>

                  <button
                    type="button"
                    onClick={forgotPassword}
                    disabled={disabled}
                    className={[
                      'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition',
                      disabled ? 'bg-white/5 text-white/40 cursor-not-allowed border border-white/10' : 'bg-[var(--accent)] hover:opacity-90',
                    ].join(' ')}
                    style={{ color: 'var(--accentText)' as any }}
                  >
                    {busy ? 'Sending…' : 'Send reset email'}
                  </button>

                  <div className="flex items-center justify-between text-xs text-white/60 pt-2">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setMode('login')
                        setToast(null)
                      }}
                      disabled={disabled}
                    >
                      Back to login
                    </button>

                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setMode('pin')
                        setToast(null)
                      }}
                      disabled={disabled}
                    >
                      Use PIN instead
                    </button>
                  </div>

                  <div className="text-[11px] text-white/45 pt-2">
                    Bookmark: <span className="text-white/70 font-semibold">https://app.yourflowcrm.com/login</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

/* ---------- UI bits ---------- */

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-white/60 mt-1">{desc}</div>
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
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7 placeholder:text-white/40'

const tabChip = 'rounded-2xl border px-3 py-2 text-xs font-semibold transition'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
