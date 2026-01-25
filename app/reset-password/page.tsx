'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

function errMsg(e: any) {
  return e?.message || e?.error_description || e?.error || 'Could not update password'
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Support PKCE reset links (?code=...)
  const code = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const u = new URL(window.location.href)
    return u.searchParams.get('code') || ''
  }, [])

  useEffect(() => {
    // ✅ Same behavior as before (session-based), but now also supports:
    // - PKCE links via ?code=
    // - Hash token links via #access_token / #refresh_token
    ;(async () => {
      try {
        // 1) PKCE flow
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        }

        // 2) Hash token flow (older recovery style)
        if (typeof window !== 'undefined' && window.location.hash?.includes('access_token=')) {
          const hash = window.location.hash.replace(/^#/, '')
          const params = new URLSearchParams(hash)
          const access_token = params.get('access_token') || ''
          const refresh_token = params.get('refresh_token') || ''

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token })
            if (error) throw error
          }
        }

        // 3) Confirm session exists (same as yesterday)
        const { data } = await supabase.auth.getSession()
        setReady(!!data.session)
      } catch (e: any) {
        setReady(false)
        setToast(errMsg(e))
      }
    })()
  }, [code])

  async function updatePassword() {
    setBusy(true)
    setToast(null)
    try {
      if (password.length < 8) throw new Error('Password must be at least 8 characters')

      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setToast('Password updated ✅ Redirecting…')
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
        <h1 className="text-2xl font-semibold">Reset password</h1>

        {!ready ? (
          <p className="text-sm text-white/60 mt-3">
            Open the reset link from your email in this same browser.
          </p>
        ) : (
          <p className="text-sm text-white/60 mt-3">Set a new password below.</p>
        )}

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
            disabled={!ready}
            autoComplete="new-password"
          />
        </div>

        <button
          onClick={updatePassword}
          disabled={busy || !ready}
          className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition bg-[var(--accent)] text-[var(--accentText)] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </div>
    </div>
  )
}
