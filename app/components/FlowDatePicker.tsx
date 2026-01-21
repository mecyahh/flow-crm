// ✅ REPLACE ENTIRE FILE: /app/components/FlowDatePicker.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function FlowDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  minYear = 1900,
  maxYear,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minYear?: number
  maxYear?: number
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  const computedMaxYear = maxYear ?? new Date().getFullYear() + 5

  const initial = useMemo(() => (value ? parseISO(value) : new Date()), [value])
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  // position
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  // years
  const years = useMemo(() => {
    const out: number[] = []
    for (let y = computedMaxYear; y >= minYear; y--) out.push(y)
    return out
  }, [computedMaxYear, minYear])

  // Sync view to selected value whenever opened
  useEffect(() => {
    if (!open) return
    const d = value ? parseISO(value) : new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }, [open, value])

  // Place popover (viewport positioning)
  useEffect(() => {
    if (!open) return

    function place() {
      const a = anchorRef.current
      if (!a) return
      const r = a.getBoundingClientRect()

      const width = 320
      const height = 360
      const gap = 8

      const vw = window.innerWidth
      const vh = window.innerHeight

      // prefer below; if not enough room, place above
      let top = r.bottom + gap
      if (top + height > vh && r.top - gap - height > 0) top = r.top - gap - height

      let left = r.left
      if (left + width > vw - 8) left = vw - width - 8
      if (left < 8) left = 8

      setPos({ top, left })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // Close on outside click (works with portal)
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!open) return
      const t = e.target as Node
      if (anchorRef.current?.contains(t)) return
      if (popRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const grid = buildMonthGrid(viewYear, viewMonth)

  const popover = open ? (
    <div
      ref={popRef}
      // ✅ PORTAL + HUGE Z: guaranteed on top of Analytics UI
      className="fixed z-[2147483647] w-[320px] rounded-2xl border border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => {
            const d = new Date(viewYear, viewMonth, 1)
            d.setMonth(d.getMonth() - 1)
            setViewYear(d.getFullYear())
            setViewMonth(d.getMonth())
          }}
          className="h-9 w-9 rounded-xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition"
          aria-label="Previous month"
        >
          ‹
        </button>

        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">{monthLabel}</div>

          <select
            className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs outline-none hover:bg-[var(--panel2)] transition"
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            aria-label="Select year"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            const d = new Date(viewYear, viewMonth, 1)
            d.setMonth(d.getMonth() + 1)
            setViewYear(d.getFullYear())
            setViewMonth(d.getMonth())
          }}
          className="h-9 w-9 rounded-xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="grid grid-cols-7 gap-1 text-[11px] text-[var(--text)]/50 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.flat().map((cell, i) => {
            const iso = toISO(cell.date)
            const isSelected = value === iso
            const isThisMonth = cell.inMonth
            const isToday = iso === toISO(new Date())

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onChange(iso)
                  setOpen(false)
                }}
                className={[
                  'h-10 rounded-xl text-sm transition border',
                  isSelected
                    ? 'bg-blue-600 border-blue-500/60 text-[var(--text)]'
                    : 'bg-[var(--panel)] border-[var(--border)] hover:bg-[var(--panel2)]',
                  !isThisMonth ? 'text-[var(--text)]/30' : 'text-[var(--text)]',
                  isToday && !isSelected ? 'ring-1 ring-white/15' : '',
                ].join(' ')}
              >
                {cell.date.getDate()}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onChange(toISO(new Date()))
              setOpen(false)
            }}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-3 py-2 text-xs"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-3 py-2 text-xs"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="relative" ref={anchorRef}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none hover:bg-white/7 transition flex items-center justify-between"
      >
        <span className={value ? 'text-[var(--text)]' : 'text-[var(--text)]/50'}>
          {value ? pretty(value) : placeholder}
        </span>
        <span className="text-[var(--text)]/50">📅</span>
      </button>

      {/* ✅ Render calendar into document.body so it never goes behind analytics UI */}
      {typeof document !== 'undefined' && popover ? createPortal(popover, document.body) : null}
    </div>
  )
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startDowMon0 = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - startDowMon0)

  const grid: { date: Date; inMonth: boolean }[][] = []
  let cur = new Date(start)
  for (let r = 0; r < 6; r++) {
    const row: { date: Date; inMonth: boolean }[] = []
    for (let c = 0; c < 7; c++) {
      row.push({ date: new Date(cur), inMonth: cur.getMonth() === month })
      cur.setDate(cur.getDate() + 1)
    }
    grid.push(row)
  }
  return grid
}

function parseISO(iso: string) {
  const [y, m, d] = iso.split('-').map((x) => Number(x))
  return new Date(y, (m || 1) - 1, d || 1)
}

function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function pretty(iso: string) {
  const d = parseISO(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}
