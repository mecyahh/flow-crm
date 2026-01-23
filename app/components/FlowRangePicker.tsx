// ✅ NEW FILE: /app/components/FlowRangePicker.tsx
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

const PRESETS: { key: PresetKey; label: string }[] = [
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

function parseRange(value: string) {
  if (!value) return { start: '', end: '' }
  const [a, b] = value.split('|')
  if (!a) return { start: '', end: '' }
  return { start: a, end: b || a }
}

function normalizeRange(start: string, end: string) {
  if (!start) return { start: '', end: '' }
  if (!end) return { start, end: start }
  const sT = parseISO(start).getTime()
  const eT = parseISO(end).getTime()
  if (sT <= eT) return { start, end }
  return { start: end, end: start }
}

export default function FlowRangePicker({
  value,
  onChange,
  placeholder = 'Select range',
  minYear = 1900,
  maxYear,
  defaultPreset = 'THIS_WEEK',
}: {
  /** Range string: "YYYY-MM-DD|YYYY-MM-DD" */
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minYear?: number
  maxYear?: number
  /** Optional: preset used only when value is empty */
  defaultPreset?: PresetKey
}) {
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  const computedMaxYear = maxYear ?? new Date().getFullYear() + 5

  const [open, setOpen] = useState(false)
  const [presetOpen, setPresetOpen] = useState(false)
  const [activeField, setActiveField] = useState<'start' | 'end'>('start')
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // If empty, auto-seed from defaultPreset (once)
  useEffect(() => {
    if (value) return
    const r = getPresetRange(defaultPreset)
    onChange(`${r.start}|${r.end}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parsed = useMemo(() => parseRange(value), [value])
  const [startISO, setStartISO] = useState(parsed.start)
  const [endISO, setEndISO] = useState(parsed.end)

  useEffect(() => {
    setStartISO(parsed.start)
    setEndISO(parsed.end)
  }, [parsed.start, parsed.end])

  // years
  const years = useMemo(() => {
    const out: number[] = []
    for (let y = computedMaxYear; y >= minYear; y--) out.push(y)
    return out
  }, [computedMaxYear, minYear])

  const activeISO = activeField === 'start' ? startISO : endISO
  const initial = useMemo(() => (activeISO ? parseISO(activeISO) : new Date()), [activeISO])
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  useEffect(() => {
    if (!open) return
    const d = activeISO ? parseISO(activeISO) : new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }, [open, activeISO])

  // position popover
  useEffect(() => {
    if (!open) return
    function place() {
      const a = anchorRef.current
      if (!a) return
      const r = a.getBoundingClientRect()

      const width = 320
      const height = 380
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

  // outside click close
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const t = e.target as Node
      if (anchorRef.current?.contains(t)) return
      if (popRef.current?.contains(t)) return
      setOpen(false)
      setPresetOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  const normalized = normalizeRange(startISO, endISO)
  const displayText =
    normalized.start && normalized.end
      ? `${pretty(normalized.start)}  -  ${pretty(normalized.end)}`
      : placeholder

  const detectedPreset = useMemo(() => detectPreset(normalized.start, normalized.end), [
    normalized.start,
    normalized.end,
  ])

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const grid = buildMonthGrid(viewYear, viewMonth)
  const todayISO = toISO(new Date())

  function commit(nextStart: string, nextEnd: string, close = false) {
    const n = normalizeRange(nextStart, nextEnd)
    setStartISO(n.start)
    setEndISO(n.end)
    onChange(n.start ? `${n.start}|${n.end}` : '')
    if (close) setOpen(false)
  }

  function onPickDay(iso: string) {
    if (activeField === 'start') {
      const nextStart = iso
      const nextEnd = endISO || iso
      commit(nextStart, nextEnd, false)
      setActiveField('end')
      return
    }
    commit(startISO || iso, iso, true)
    setActiveField('start')
  }

  function applyPreset(key: PresetKey) {
    const r = getPresetRange(key)
    commit(r.start, r.end, true)
    setPresetOpen(false)
    setActiveField('start')
  }

  const popover = open ? (
    <div
      ref={popRef}
      className="fixed z-[2147483647] w-[320px] rounded-2xl border border-white/10 bg-[#0b0f1a]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* top: start/end toggle */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveField('start')}
            className={[
              'px-2 py-1 rounded-lg text-xs border transition',
              activeField === 'start'
                ? 'bg-white/10 border-white/15 text-white'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10',
            ].join(' ')}
          >
            Start
          </button>
          <button
            type="button"
            onClick={() => setActiveField('end')}
            className={[
              'px-2 py-1 rounded-lg text-xs border transition',
              activeField === 'end'
                ? 'bg-white/10 border-white/15 text-white'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10',
            ].join(' ')}
          >
            End
          </button>
        </div>

        <div className="text-[11px] text-white/55">
          {normalized.start ? pretty(normalized.start) : '—'}{' '}
          <span className="text-white/35">→</span>{' '}
          {normalized.end ? pretty(normalized.end) : '—'}
        </div>
      </div>

      {/* calendar header */}
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

      {/* grid */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-7 gap-1 text-[11px] text-white/50 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.flat().map((cell, i) => {
            const iso = toISO(cell.date)
            const isThisMonth = cell.inMonth
            const isToday = iso === todayISO

            const inRange =
              normalized.start && normalized.end
                ? isBetweenInclusive(iso, normalized.start, normalized.end)
                : false

            const isStart = normalized.start && iso === normalized.start
            const isEnd = normalized.end && iso === normalized.end

            const base = 'h-10 rounded-xl text-sm transition border'
            const dim = !isThisMonth ? 'text-white/30' : 'text-white'
            const bg =
              isStart || isEnd
                ? 'bg-blue-600 border-blue-500/60 text-white'
                : inRange
                  ? 'bg-white/10 border-white/10 hover:bg-white/12'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
            const ring = isToday && !(isStart || isEnd) ? 'ring-1 ring-white/15' : ''

            return (
              <button
                key={i}
                type="button"
                onClick={() => onPickDay(iso)}
                className={[base, bg, dim, ring].join(' ')}
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
              const t = toISO(new Date())
              commit(t, t, true)
              setActiveField('start')
            }}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              setStartISO('')
              setEndISO('')
              onChange('')
              setOpen(false)
              setActiveField('start')
            }}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  ) : null

  // ✅ Thin single control (preset + range)
  return (
    <div ref={anchorRef} className="relative inline-flex items-center">
      <div className="inline-flex items-center rounded-md border border-white/10 bg-white/5 overflow-hidden">
        {/* Preset */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPresetOpen((s) => !s)}
            className="px-2 py-[6px] text-[13px] text-white/90 hover:bg-white/10 transition flex items-center gap-1"
            aria-haspopup="menu"
            aria-expanded={presetOpen}
          >
            <span>{detectedPreset}</span>
            <span className="text-white/50">▾</span>
          </button>

          {presetOpen ? (
            <div className="absolute left-0 mt-2 w-56 rounded-xl border border-white/10 bg-[#0b0f1a]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[2147483647]">
              <div className="p-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.key)}
                    className="w-full text-left rounded-lg px-3 py-2 text-[13px] text-white/90 hover:bg-white/10 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-white/10" />

        {/* Range */}
        <button
          type="button"
          onClick={() => {
            setOpen((s) => !s)
            setActiveField('start')
          }}
          className="px-2 py-[6px] text-[13px] text-white/90 hover:bg-white/10 transition flex items-center gap-2"
        >
          <span className={normalized.start ? 'text-white/90' : 'text-white/55'}>{displayText}</span>
          <span className="text-white/70">
            <CalendarGlassIcon />
          </span>
        </button>
      </div>

      {typeof document !== 'undefined' && popover ? createPortal(popover, document.body) : null}
    </div>
  )
}

function CalendarGlassIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3v3M17 3v3"
        stroke="rgba(255,255,255,0.80)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 8h16"
        stroke="rgba(255,255,255,0.80)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6 6h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2Z"
        stroke="rgba(255,255,255,0.80)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* helpers */
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

/* presets */
function startOfWeekMon(d: Date) {
  const day = (d.getDay() + 6) % 7
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
  const out = new Date(d.getFullYear(), d.getMonth(), 1)
  out.setHours(0, 0, 0, 0)
  return out
}
function endOfMonth(d: Date) {
  const out = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  out.setHours(0, 0, 0, 0)
  return out
}
function startOfYear(d: Date) {
  const out = new Date(d.getFullYear(), 0, 1)
  out.setHours(0, 0, 0, 0)
  return out
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

function getPresetRange(key: PresetKey): { start: string; end: string } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  switch (key) {
    case 'THIS_WEEK':
      return { start: toISO(startOfWeekMon(now)), end: toISO(endOfWeekSun(now)) }
    case 'LAST_WEEK': {
      const last = addDays(now, -7)
      return { start: toISO(startOfWeekMon(last)), end: toISO(endOfWeekSun(last)) }
    }
    case 'PAST_7':
      return { start: toISO(addDays(now, -6)), end: toISO(now) }
    case 'PAST_14':
      return { start: toISO(addDays(now, -13)), end: toISO(now) }
    case 'THIS_MONTH':
      return { start: toISO(startOfMonth(now)), end: toISO(endOfMonth(now)) }
    case 'LAST_MONTH': {
      const prev = addMonths(now, -1)
      return { start: toISO(startOfMonth(prev)), end: toISO(endOfMonth(prev)) }
    }
    case 'PAST_30':
      return { start: toISO(addDays(now, -29)), end: toISO(now) }
    case 'PAST_90':
      return { start: toISO(addDays(now, -89)), end: toISO(now) }
    case 'PAST_180':
      return { start: toISO(addDays(now, -179)), end: toISO(now) }
    case 'PAST_12_MONTHS':
      return { start: toISO(addMonths(now, -12)), end: toISO(now) }
    case 'YTD':
      return { start: toISO(startOfYear(now)), end: toISO(now) }
    default:
      return { start: toISO(now), end: toISO(now) }
  }
}

function detectPreset(start: string, end: string) {
  if (!start || !end) return 'Custom'
  for (const p of PRESETS) {
    const r = getPresetRange(p.key)
    if (r.start === start && r.end === end) return p.label
  }
  return 'Custom'
}
