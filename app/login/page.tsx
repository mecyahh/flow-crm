// /app/login/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const appUrl =
    (process.env.NEXT_PUBLIC_APP_URL || '').trim() ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) window.location.href = '/dashboard'
    })()
  }, [])

  const canSubmit = useMemo(() => {
    const e = email.trim()
    if (!e.includes('@')) return false
    if (mode === 'reset') return true
    if (password.length < 6) return false
    if (mode === 'signup' && password !== confirm) return false
    return true
  }, [email, password, confirm, mode])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    try {
      setLoading(true)
      setToast(null)

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        window.location.href = '/dashboard'
        return
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${appUrl}/login`,
          },
        })
        if (error) throw error
        setToast('Account created ✅ Check your email if confirmation is required.')
        setMode('login')
        setPassword('')
        setConfirm('')
        return
      }

      // reset
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${appUrl}/reset-password`,
      })
      if (error) throw error
      setToast('Password reset email sent ✅')
      setMode('login')
    } catch (err: any) {
      setToast(err?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white flex items-center justify-center px-6 py-10">
      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-white/10 shadow-2xl max-w-[360px]">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3">
              <button className={btnSoft} onClick={() => setToast(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-[980px] grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-3xl border border-white/10 p-8 overflow-hidden relative">
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative">
            <div className="text-xs text-white/60">FLOW</div>
            <h1 className="text-3xl font-semibold tracking-tight mt-2">Deal House Portal</h1>
            <p className="text-sm text-white/60 mt-3 leading-relaxed">
              Clean, glass-theme tracking for production, follow ups, and team momentum.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Feature label="Fast tracking" desc="Post deals in seconds." />
              <Feature label="Follow ups" desc="No deals slipping." />
              <Feature label="Leaderboards" desc="Competitive output." />
              <Feature label="Analytics" desc="Clean signal." />
            </div>

            <div className="mt-8 text-xs text-white/50">
              By continuing you agree to your agency’s policies.
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl border border-white/10 p-8">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">
              {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Reset password'}
            </div>
            <Link href="/dashboard" className="text-xs text-white/60 hover:underline">
              Back to dashboard
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <button
              onClick={() => setMode('login')}
              className={pill(mode === 'login')}
              type="button"
            >
              Login
            </button>
            <button
              onClick={() => setMode('signup')}
              className={pill(mode === 'signup')}
              type="button"
            >
              Create
            </button>
            <button
              onClick={() => setMode('reset')}
              className={pill(mode === 'reset')}
              type="button"
            >
              Forgot
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Email">
              <input
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </Field>

            {mode !== 'reset' && (
              <Field label="Password">
                <input
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </Field>
            )}

            {mode === 'signup' && (
              <Field label="Confirm password">
                <input
                  className={inputCls}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete="new-password"
                />
              </Field>
            )}

            <button
              disabled={loading || !canSubmit}
              className={[
                'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition border',
                loading || !canSubmit
                  ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                  : 'bg-blue-600 border-blue-500/60 hover:bg-blue-500',
              ].join(' ')}
              type="submit"
            >
              {loading
                ? 'Working…'
                : mode === 'login'
                ? 'Log in'
                : mode === 'signup'
                ? 'Create account'
                : 'Send reset email'}
            </button>

            <div className="flex items-center justify-between text-xs text-white/60 pt-2">
              <button
                type="button"
                className="hover:underline"
                onClick={() => setMode('reset')}
              >
                Forgot password?
              </button>
              <div className="flex items-center gap-2">
                <span>{mode === 'login' ? `Don't have an account?` : `Already have an account?`}</span>
                <button
                  type="button"
                  className="text-white hover:underline"
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                >
                  {mode === 'login' ? 'Create' : 'Log in'}
                </button>
              </div>
            </div>

            <div className="text-[11px] text-white/45 pt-2">
              Trouble logging in? Verify you used the invite email and confirmed your account (if enabled).
            </div>
          </form>
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

function Feature({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-xs text-white/60 mt-1">{desc}</div>
    </div>
  )
}

function pill(active: boolean) {
  return [
    'rounded-2xl border px-3 py-2 text-xs font-semibold transition',
    active ? 'bg-white/10 border-white/15' : 'bg-white/5 border-white/10 hover:bg-white/10',
  ].join(' ')
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
