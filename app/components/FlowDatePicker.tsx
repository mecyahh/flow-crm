// ✅ REPLACE ENTIRE FILE: /app/components/FlowDatePicker.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type PresetKey =
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | 'PAST_7'
  | 'PAST_14'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'PAST_30'
  | 'PAST_90'
  | 'PAST_180'
  | 'PAST_12_MONTHS'
  | 'YTD'

type Preset = { key: PresetKey; label: string }

const PRESETS: Preset[] = [
  { key: 'THIS_WEEK', label: 'This Week' },
  { key: 'LAST_WEEK', label: 'Last Week' },
  { key: 'PAST_7', label: 'Past 7 Days' },
  { key: 'PAST_14', label: 'Past 14 Days' },
  { key: 'THIS_MONTH', label: 'This Month' },
  { key: 'LAST_MONTH', label: 'Last Month' },
  { key: 'PAST_30', label: 'Past 30 Days' },
  { key: 'PAST_90', label: 'Past 90 Days' },
  { key: 'PAST_180', label: 'Past 180 Days' },
  { key: 'PAST_12_MONTHS', label: 'Past 12 Months' },
  { key: 'YTD', label: 'YTD' },
]

function parseValue(value: string): { start: string; end: string; isRange: boolean } {
  if (!value) return { start: '', end: '', isRange: false }
  const parts = value.split('|')
  if (parts.length === 2) return { start: parts[0] || '', end: parts[1] || '', isRange: true }
  return { start: value, end: value, isRange: false }
}

function formatValue(start: string, end: string, range: boolean) {
  if (!start) return ''
  if (!range) return start
  return `${start}|${end || start}`
}

export default function FlowDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  minYear = 1900,
  maxYear,
  range = true,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minYear?: number
  maxYear?: number
  /** ✅ When true, returns "YYYY-MM-DD|YYYY-MM-DD". When false, returns "YYYY-MM-DD" */
  range?: boolean
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  const computedMaxYear = maxYear ?? new Date().getFullYear() + 5

  // popover position
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  // internal selection
  const parsed = useMemo(() => parseValue(value), [value])
  const [startISO, setStartISO] = useState(parsed.start)
  const [endISO, setEndISO] = useState(parsed.end)

  // which input is being edited in range mode
  const [activeField, setActiveField] = useState<'start' | 'end'>('start')

  // preset dropdown
  const [presetOpen, setPresetOpen] = useState(false)
  const [presetLabel, setPresetLabel] = useState<string>(() => {
    if (!value) return 'Custom'
    return range ? 'Custom' : 'Custom'
  })

  const initial = useMemo(() => {
    const d = startISO ? parseISO(startISO) : new Date()
    return d
  }, [startISO])

  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  // years
  const years = useMemo(() => {
    const out: number[] = []
    for (let y = computedMaxYear; y >= minYear; y--) out.push(y)
    return out
  }, [computedMaxYear, minYear])

  // sync internal state when value changes externally
  useEffect(() => {
    setStartISO(parsed.start)
    setEndISO(parsed.end)
  }, [parsed.start, parsed.end])

  // Sync view to selection whenever opened
  useEffect(() => {
    if (!open) return
    const d = startISO ? parseISO(startISO) : new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }, [open, startISO])

  // Place popover (viewport positioning)
  useEffect(() => {
    if (!open) return

    function place() {
      const a = anchorRef.current
      if (!a) return
      const r = a.getBoundingClientRect()

      const width = 360
      const height = 420
      const gap = 8

      const vw = window.innerWidth
      const vh = window.innerHeight

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
      const t = e.target as Node
      if (presetOpen) {
        // close preset dropdown if click outside
        if (!anchorRef.current?.contains(t)) setPresetOpen(false)
      }
      if (!open) return
      if (anchorRef.current?.contains(t)) return
      if (popRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open, presetOpen])

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const grid = buildMonthGrid(viewYear, viewMonth)
  const todayISO = toISO(new Date())

  function commit(nextStart: string, nextEnd: string, close = true) {
    // normalize range ordering
    let s = nextStart
    let e = nextEnd
    if (range && s && e) {
      const sd = parseISO(s).getTime()
      const ed = parseISO(e).getTime()
      if (sd > ed) {
        const tmp = s
        s = e
        e = tmp
      }
    } else if (!range) {
      e = s
    }

    setStartISO(s)
    setEndISO(e)
    onChange(formatValue(s, e, range))

    if (close) setOpen(false)
  }

  function applyPreset(key: PresetKey) {
    const { start, end, label } = getPresetRange(key)
    setPresetLabel(label)
    setActiveField('start')
    commit(start, end, true)
  }

  function onPickDay(iso: string) {
    setPresetLabel('Custom')

    if (!range) {
      commit(iso, iso, true)
      return
    }

    // range mode
    if (activeField === 'start') {
      // set start; if end is empty, keep end = start for now
      setStartISO(iso)
      if (!endISO) setEndISO(iso)
      setActiveField('end')
      // keep popover open to pick end
      onChange(formatValue(iso, endISO || iso, true))
      return
    } else {
      // set end and close
      commit(startISO || iso, iso, true)
      setActiveField('start')
    }
  }

  const popover = open ? (
    <div
      ref={popRef}
      className="fixed z-[2147483647] w-[360px] rounded-2xl border border-white/10 bg-[#0b0f1a]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <button
          type="button"
          onClick={() => {
            const d = new Date(viewYear, viewMonth, 1)
            d.setMonth(d.getMonth() - 1)
            setViewYear(d.getFullYear())
            setViewMonth(d.getMonth())
          }}
          className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
          aria-label="Previous month"
        >
          ‹
        </button>

        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">{monthLabel}</div>

          <select
            className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none hover:bg-white/10 transition"
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
          className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* body */}
      <div className="px-4 py-3">
        {/* weekday header */}
        <div className="grid grid-cols-7 gap-1 text-[11px] text-white/50 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center">
              {d}
            </div>
          ))}
        </div>

        {/* days */}
        <div className="grid grid-cols-7 gap-1">
          {grid.flat().map((cell, i) => {
            const iso = toISO(cell.date)
            const isThisMonth = cell.inMonth
            const isToday = iso === todayISO

            const inRange =
              range && startISO && endISO
                ? isBetweenInclusive(iso, startISO, endISO)
                : false

            const isStart = startISO && iso === startISO
            const isEnd = endISO && iso === endISO
            const isSelectedSingle = !range && startISO && iso === startISO

            const base =
              'h-10 rounded-xl text-sm transition border relative overflow-hidden'
            const dim = !isThisMonth ? 'text-white/30' : 'text-white'

            const bg =
              isSelectedSingle || isStart || isEnd
                ? 'bg-blue-600 border-blue-500/60 text-white'
                : inRange
                  ? 'bg-white/10 border-white/10 hover:bg-white/12'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'

            const ring = isToday && !(isSelectedSingle || isStart || isEnd) ? 'ring-1 ring-white/15' : ''

            return (
              <button
                key={i}
                type="button"
                onClick={() => onPickDay(iso)}
                className={[base, bg, dim, ring].join(' ')}
                aria-label={`Pick ${iso}`}
              >
                {cell.date.getDate()}
              </button>
            )
          })}
        </div>

        {/* actions */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const t = toISO(new Date())
              setPresetLabel('Custom')
              if (!range) {
                commit(t, t, true)
              } else {
                commit(t, t, true)
              }
            }}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => {
              setPresetLabel('Custom')
              setStartISO('')
              setEndISO('')
              onChange('')
              setOpen(false)
            }}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs"
          >
            Clear
          </button>
        </div>

        {range ? (
          <div className="mt-2 text-[11px] text-white/50">
            Tip: pick a <span className="text-white/70">start</span> date, then pick an{' '}
            <span className="text-white/70">end</span> date.
          </div>
        ) : null}
      </div>
    </div>
  ) : null

  // UI: preset dropdown + start/end fields (inspected pattern) but in your glass Tailwind style
  return (
    <div className="relative" ref={anchorRef}>
      <div className="flex items-stretch gap-2">
        {/* Left: preset dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPresetOpen((s) => !s)}
            className="h-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none hover:bg-white/7 transition flex items-center gap-2"
            aria-haspopup="menu"
            aria-expanded={presetOpen}
          >
            <span className="text-white">{presetLabel === 'Custom' ? (range ? 'Custom Range' : 'Custom') : presetLabel}</span>
            <span className="text-white/50">▾</span>
          </button>

          {presetOpen ? (
            <div className="absolute mt-2 w-56 rounded-2xl border border-white/10 bg-[#0b0f1a]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[2147483647]">
              <div className="p-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setPresetOpen(false)
                      // presets imply range; if range=false we still set start (and end=start)
                      applyPreset(p.key)
                    }}
                    className="w-full text-left rounded-xl px-3 py-2 text-sm text-white/90 hover:bg-white/10 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Middle: start "input" */}
        <button
          type="button"
          onClick={() => {
            setActiveField('start')
            setOpen(true)
          }}
          className={[
            'flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none hover:bg-white/7 transition flex items-center justify-between',
            range && activeField === 'start' && open ? 'ring-1 ring-white/15' : '',
          ].join(' ')}
        >
          <span className={startISO ? 'text-white' : 'text-white/50'}>
            {startISO ? pretty(startISO) : placeholder}
          </span>
          <span className="text-white/50">📅</span>
        </button>

        {/* Dash */}
        <div className="flex items-center text-white/40 px-1 select-none">-</div>

        {/* Right: end "input" (only meaningful in range mode, but still displays nicely) */}
        <button
          type="button"
          onClick={() => {
            setActiveField('end')
            setOpen(true)
          }}
          className={[
            'flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none hover:bg-white/7 transition flex items-center justify-between',
            range && activeField === 'end' && open ? 'ring-1 ring-white/15' : '',
          ].join(' ')}
        >
          <span className={endISO ? 'text-white' : 'text-white/50'}>
            {endISO ? pretty(endISO) : placeholder}
          </span>
          <span className="text-white/50">📅</span>
        </button>
      </div>

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

function isBetweenInclusive(iso: string, a: string, b: string) {
  const t = parseISO(iso).getTime()
  const ta = parseISO(a).getTime()
  const tb = parseISO(b).getTime()
  const lo = Math.min(ta, tb)
  const hi = Math.max(ta, tb)
  return t >= lo && t <= hi
}

function startOfWeekMon(d: Date) {
  const day = (d.getDay() + 6) % 7 // Mon=0 ... Sun=6
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - day)
  return out
}
function endOfWeekSun(d: Date) {
  const s = startOfWeekMon(d)
  const out = new Date(s)
  out.setDate(out.getDate() + 6)
  return out
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}
function addDays(d: Date, n: number) {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}
function addMonths(d: Date, n: number) {
  const out = new Date(d)
  out.setMonth(out.getMonth() + n)
  return out
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1)
}

function getPresetRange(key: PresetKey): { start: string; end: string; label: string } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  switch (key) {
    case 'THIS_WEEK': {
      const s = startOfWeekMon(now)
      const e = endOfWeekSun(now)
      return { start: toISO(s), end: toISO(e), label: 'This Week' }
    }
    case 'LAST_WEEK': {
      const last = addDays(now, -7)
      const s = startOfWeekMon(last)
      const e = endOfWeekSun(last)
      return { start: toISO(s), end: toISO(e), label: 'Last Week' }
    }
    case 'PAST_7': {
      const e = now
      const s = addDays(now, -6)
      return { start: toISO(s), end: toISO(e), label: 'Past 7 Days' }
    }
    case 'PAST_14': {
      const e = now
      const s = addDays(now, -13)
      return { start: toISO(s), end: toISO(e), label: 'Past 14 Days' }
    }
    case 'THIS_MONTH': {
      const s = startOfMonth(now)
      const e = endOfMonth(now)
      return { start: toISO(s), end: toISO(e), label: 'This Month' }
    }
    case 'LAST_MONTH': {
      const prev = addMonths(now, -1)
      const s = startOfMonth(prev)
      const e = endOfMonth(prev)
      return { start: toISO(s), end: toISO(e), label: 'Last Month' }
    }
    case 'PAST_30': {
      const e = now
      const s = addDays(now, -29)
      return { start: toISO(s), end: toISO(e), label: 'Past 30 Days' }
    }
    case 'PAST_90': {
      const e = now
      const s = addDays(now, -89)
      return { start: toISO(s), end: toISO(e), label: 'Past 90 Days' }
    }
    case 'PAST_180': {
      const e = now
      const s = addDays(now, -179)
      return { start: toISO(s), end: toISO(e), label: 'Past 180 Days' }
    }
    case 'PAST_12_MONTHS': {
      const e = now
      const s = addMonths(now, -12)
      // keep same day; treat as rolling 12 months
      return { start: toISO(s), end: toISO(e), label: 'Past 12 Months' }
    }
    case 'YTD': {
      const s = startOfYear(now)
      const e = now
      return { start: toISO(s), end: toISO(e), label: 'YTD' }
    }
    default: {
      return { start: toISO(now), end: toISO(now), label: 'Custom' }
    }
  }
}
