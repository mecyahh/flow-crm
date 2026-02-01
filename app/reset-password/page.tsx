'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

function errMsg(e: any) {
  return e?.message || e?.error_description || e?.error || 'Something failed'
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // controls whether we’re allowed to show the form
  const [ready, setReady] = useState(false)

  // ✅ Read token_hash from URL
  const { tokenHash, type } = useMemo(() => {
    if (typeof window === 'undefined') return { tokenHash: '', type: 'recovery' as const }
    const u = new URL(window.location.href)
    return {
      tokenHash: u.searchParams.get('token_hash') || '',
      type: (u.searchParams.get('type') as 'recovery' | 'invite' | 'magiclink' | 'email') || 'recovery',
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        setToast(null)
        setReady(false)

        // ✅ Universal recovery flow (no PKCE verifier needed)
        if (!tokenHash) {
          throw new Error('Invalid or missing reset token. Please request a new reset link from the login page.')
        }

        const { error } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        })

        if (error) throw error

        // We now have a recovery session; show password form
        setReady(true)
      } catch (e: any) {
        setReady(false)
        setToast(errMsg(e))
      }
    })()
  }, [tokenHash, type])

  async function updatePassword() {
    setBusy(true)
    setToast(null)
    try {
      if (!ready) throw new Error('Reset session is not active. Please request a new reset link.')
      if (password.length < 8) throw new Error('Password must be at least 8 characters')
      if (password !== confirm) throw new Error('Passwords do not match')

      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      // ⚠️ Passwords are NOT stored in profiles (and should never be).
      // Updating Supabase Auth password is what enables future logins.

      setToast('Password updated ✅ Redirecting to login…')
      setTimeout(() => (window.location.href = '/login'), 800)
    } catch (e: any) {
      setToast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-4">
      <div className="w-full max-w-md glass rounded-2xl border border-white/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold">Reset password</h1>

          <button
            type="button"
            onClick={() => (window.location.href = '/login')}
            className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs font-semibold"
          >
            Back to Login
          </button>
        </div>

        <p className="text-sm text-white/60 mt-3">
          Enter your new password below.
        </p>

        {toast && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            {toast}
          </div>
        )}

        <div className="mt-5">
          <label className="text-[11px] text-white/60">New Password</label>
          <input
            type="password"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            disabled={!ready || busy}
            autoComplete="new-password"
          />
        </div>

        <div className="mt-4">
          <label className="text-[11px] text-white/60">Confirm Password</label>
          <input
            type="password"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/10"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter password"
            disabled={!ready || busy}
            autoComplete="new-password"
          />
        </div>

        <button
          onClick={updatePassword}
          disabled={!ready || busy}
          className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition bg-[var(--accent)] text-[var(--accentText)] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Update password'}
        </button>

        <div className="mt-3 text-[11px] text-white/55">
          After saving, you’ll be routed back to login automatically.
        </div>
      </div>
    </div>
  )
}
