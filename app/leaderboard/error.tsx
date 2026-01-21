// ✅ FILE: /app/leaderboard/error.tsx  (CREATE THIS FILE)
// Prevents the generic "Application error" screen for leaderboard.

'use client'

export default function LeaderboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel2)] backdrop-blur-xl p-6 max-w-xl w-full">
        <div className="text-xl font-semibold">Leaderboard crashed</div>
        <div className="mt-2 text-sm text-[var(--text)]/70">
          {error?.message || 'Unknown error'}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => reset()}
            className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] hover:bg-white/20 transition px-4 py-2 text-sm font-semibold"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] hover:bg-white/20 transition px-4 py-2 text-sm font-semibold"
          >
            Refresh
          </button>
          <a
            href="/login"
            className="rounded-xl bg-blue-600 hover:bg-blue-500 transition px-4 py-2 text-sm font-semibold"
          >
            Login
          </a>
        </div>

        <div className="mt-4 text-[11px] text-[var(--text)]/50">
          If it keeps happening, open browser console and copy the first red error line.
        </div>
      </div>
    </div>
  )
}
