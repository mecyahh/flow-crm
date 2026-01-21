'use client'

import { useEffect, useMemo, useState } from 'react'

type Noti = {
  id: string
  title: string
  body: string
  ts: number
  href?: string
  read?: boolean
}

const KEY = 'flow_notifications_v1'

export function pushNotification(n: Omit<Noti, 'ts' | 'read'>) {
  const now = Date.now()
  const item: Noti = { ...n, ts: now, read: false }
  const list = readAll()
  const next = [item, ...list].slice(0, 50)
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('flow:notify'))
}

function readAll(): Noti[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as Noti[]
  } catch {
    return []
  }
}

function writeAll(list: Noti[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Noti[]>([])
  const unread = useMemo(() => items.filter((x) => !x.read).length, [items])

  useEffect(() => {
    function refresh() {
      setItems(readAll())
    }
    refresh()
    window.addEventListener('flow:notify', refresh as any)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('flow:notify', refresh as any)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  function markAllRead() {
    const next = items.map((x) => ({ ...x, read: true }))
    setItems(next)
    writeAll(next)
  }

  function clearAll() {
    setItems([])
    writeAll([])
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-2xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-4 py-2 text-sm"
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1 rounded-full bg-red-600 text-[var(--text)] text-[11px] flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] rounded-2xl border border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
            <div className="text-sm font-semibold">Notifications</div>
            <div className="flex gap-2">
              <button
                onClick={markAllRead}
                className="rounded-xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-3 py-2 text-xs"
              >
                Mark read
              </button>
              <button
                onClick={clearAll}
                className="rounded-xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-3 py-2 text-xs"
              >
                Clear
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-6 text-sm text-[var(--text)]/60">No notifications.</div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              {items.map((n) => (
                <div
                  key={`${n.id}-${n.ts}`}
                  className={[
                    'px-4 py-3 border-b border-[var(--border)]',
                    n.read ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  <div className="text-sm font-semibold">{n.title}</div>
                  <div className="text-xs text-[var(--text)]/60 mt-1">{n.body}</div>
                  <div className="text-[11px] text-[var(--text)]/40 mt-2">
                    {new Date(n.ts).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
