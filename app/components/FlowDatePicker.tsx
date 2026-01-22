// ✅ REPLACE ENTIRE FILE: /app/components/FlowDatePicker.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * FlowDatePicker
 * - Backwards compatible (single date): value + onChange
 * - ALSO supports the EXACT “dashboard” style from your screenshots (range picker + presets):
 *    range
 *    startValue, endValue
 *    onRangeChange
 */
export default function FlowDatePicker(props: {
  // ✅ single-date mode (existing)
  value?: string
  onChange?: (v: string) => void
  placeholder?: string

  // ✅ range mode (your screenshot)
  range?: boolean
  startValue?: string
  endValue?: string
  onRangeChange?: (startISO: string, endISO: string) => void

  // limits
  minYear?: number
  maxYear?: number

  // optional: week starts Monday in presets (your screenshot shows Mon→Sun weeks)
  weekStartsOnMonday?: boolean
}) {
  const {
    value = '',
    onChange,
    placeholder = 'Select date',
    range = false,
    startValue = '',
    endValue = '',
    onRangeChange,
    minYear = 1900,
    maxYear,
    weekStartsOnMonday = true,
  } = props

  const anchorRef = useRef<HTMLDivElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  const [open, setOpen] = useState(false)
  const [activeField, setActiveField] = useState<'start' | 'end'>('start')

  const computedMaxYear = maxYear ?? new Date().getFullYear() + 5

  // For calendar view: choose a sensible date to open on
  const initial = useMemo(() => {
    if (range) return startValue ? parseISO(startValue) : new Date()
    return value ? parseISO(value) : new Date()
  }, [range, startValue, value])

  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  // viewport position
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  // years list for dropdown
  const years = useMemo(() => {
    const out: number[] = []
    for (let y = computedMaxYear; y >= minYear; y--) out.push(y)
    return out
  }, [computedMaxYear, minYear])

  // Sync view when opened
  useEffect(() => {
    if (!open) return
    const d =
      range
        ? (activeField === 'end' ? endValue : startValue)
          ? parseISO(activeField === 'end' ? endValue : startValue)
          : new Date()
        : value
          ? parseISO(value)
          : new Date()

    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }, [open, range, value, startValue, endValue, activeField])

  // Place popover (portal-friendly)
  useEffect(() => {
    if (!open) return

    function place() {
      const a = anchorRef.current
      if (!a) return
      const r = a.getBoundingClientRect()

      // Screenshot-like popover (presets + calendar)
      const width = range ? 460 : 300
      const height = 320
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
  }, [open, range])

  // Close on outside click
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

  // Month label shown like “January”
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
  })

  const grid = buildMonthGridSunStart(viewYear, viewMonth)

  // current selections
  const singleISO = value
  const rangeStart = startValue
  const rangeEnd = endValue

  // helpers
  function setSingle(iso: string) {
    onChange?.(iso)
    setOpen(false)
  }

  function setRangePick(iso: string) {
    // click behavior: choose active field or auto-build range
    const s = rangeStart
    const e = rangeEnd

    // If the user explicitly clicked inside start/end box, respect it:
    if (activeField === 'start') {
      // set start, clear end if end < start
      if (e && compareISO(e, iso) < 0) {
        onRangeChange?.(iso, '')
        setActiveField('end')
        return
      }
      onRangeChange?.(iso, e || '')
      setActiveField('end')
      return
    }

    // active end
    if (!s) {
      onRangeChange?.(iso, '')
      setActiveField('end')
      return
    }
    if (compareISO(iso, s) < 0) {
      // if picked end before start, swap
      onRangeChange?.(iso, s)
      setOpen(false)
      return
    }
    onRangeChange?.(s, iso)
    setOpen(false)
  }

  // ✅ Presets exactly like your screenshot list
  const presets = useMemo(() => {
    if (!range) return []
    const now = new Date()
    return [
      { label: 'This Week', range: presetThisWeek(now, weekStartsOnMonday) },
      { label: 'Last Week', range: presetLastWeek(now, weekStartsOnMonday) },
      { label: 'Past 7 Days', range: presetPastDays(now, 7) },
      { label: 'Past 14 Days', range: presetPastDays(now, 14) },
      { label: 'This Month', range: presetThisMonth(now) },
      { label: 'Last Month', range: presetLastMonth(now) },
      { label: 'Past 30 Days', range: presetPastDays(now, 30) },
      { label: 'Past 90 Days', range: presetPastDays(now, 90) },
      { label: 'Past 180 Days', range: presetPastDays(now, 180) },
      { label: 'Past 12 Months', range: presetPastMonths(now, 12) },
      { label: 'YTD', range: presetYTD(now) },
    ]
  }, [range, weekStartsOnMonday])

  function applyPreset(start: string, end: string) {
    onRangeChange?.(start, end)
    // open calendar on start month (matches typical dashboards)
    const d = parseISO(start)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    setOpen(false)
  }

  // Popover UI (light, compact, exact vibe of screenshot)
  const popover = open ? (
    <div
      ref={popRef}
      className={[
        'fixed z-[2147483647] rounded-xl border border-black/10 bg-white shadow-2xl overflow-hidden',
        range ? 'w-[460px]' : 'w-[300px]',
      ].join(' ')}
      style={{ top: pos.top, left: pos.left }}
    >
      <div className={range ? 'flex' : ''}>
        {/* LEFT: presets column (screenshot) */}
        {range ? (
          <div className="w-[170px] border-r border-black/10 bg-white">
            <div className="py-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.range.start, p.range.end)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-black/[0.04] transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* RIGHT: calendar */}
        <div className="flex-1 bg-white">
          {/* Header: arrows + “January” + year dropdown + arrows */}
          <div className="px-3 py-2 flex items-center justify-between border-b border-black/10">
            <button
              type="button"
              onClick={() => {
                const d = new Date(viewYear, viewMonth, 1)
                d.setMonth(d.getMonth() - 1)
                setViewYear(d.getFullYear())
                setViewMonth(d.getMonth())
              }}
              className="h-8 w-8 rounded-lg hover:bg-black/[0.05] transition text-lg leading-none"
              aria-label="Previous month"
            >
              ‹
            </button>

            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">{monthName}</div>
              <select
                className="rounded-lg border border-black/10 bg-white px-2 py-1 text-sm outline-none"
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
              className="h-8 w-8 rounded-lg hover:bg-black/[0.05] transition text-lg leading-none"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="px-3 py-3">
            {/* Weekdays row: Sun..Sat (screenshot) */}
            <div className="grid grid-cols-7 text-[12px] text-black/60 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center">
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-y-1">
              {grid.flat().map((cell, i) => {
                const iso = toISO(cell.date)
                const inMonth = cell.inMonth

                // single mode
                const isSelectedSingle = !range && singleISO === iso

                // range mode
                const hasS = !!rangeStart
                const hasE = !!rangeEnd
                const isS = range && rangeStart === iso
                const isE = range && rangeEnd === iso
                const inBetween =
                  range &&
                  hasS &&
                  hasE &&
                  compareISO(iso, rangeStart) > 0 &&
                  compareISO(iso, rangeEnd) < 0

                const baseText = inMonth ? 'text-black' : 'text-black/30'

                // EXACT look:
                // - start: filled blue circle
                // - end: blue outline circle
                // - between: faint blue pill background
                const cls = [
                  'h-9 w-9 mx-auto rounded-full text-sm transition flex items-center justify-center',
                  'hover:bg-black/[0.05]',
                  baseText,
                  inBetween ? 'bg-blue-500/10 hover:bg-blue-500/15' : '',
                  isSelectedSingle ? 'bg-blue-600 text-white hover:bg-blue-600' : '',
                  isS ? 'bg-blue-600 text-white hover:bg-blue-600' : '',
                  isE ? 'ring-2 ring-blue-600 text-black hover:bg-black/[0.05]' : '',
                ].join(' ')

                return (
                  <button
                    key={i}
                    type="button"
                    className={cls}
                    onClick={() => {
                      if (range) setRangePick(iso)
                      else setSingle(iso)
                    }}
                    aria-label={`Pick ${iso}`}
                  >
                    {cell.date.getDate()}
                  </button>
                )
              })}
            </div>

            {/* Footer actions (nice to have; unobtrusive) */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const t = toISO(new Date())
                  if (range) {
                    onRangeChange?.(t, t)
                  } else {
                    onChange?.(t)
                  }
                  setOpen(false)
                }}
                className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs hover:bg-black/[0.04] transition"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => {
                  if (range) onRangeChange?.('', '')
                  else onChange?.('')
                  setOpen(false)
                }}
                className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs hover:bg-black/[0.04] transition"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null

  // ✅ Top control row
  // - In range mode: “This Week” dropdown + Start + End (exact dashboard vibe)
  // - In single mode: one button (your old behavior)
  return (
    <div className="relative" ref={anchorRef}>
      {range ? (
        <div className="flex items-center gap-2">
          {/* Preset dropdown trigger (matches screenshot: “This Week ▾”) */}
          <button
            type="button"
            onClick={() => {
              setOpen((s) => !s)
              setActiveField('start')
            }}
            className="h-10 rounded-lg border border-black/10 bg-white px-3 text-sm hover:bg-black/[0.04] transition flex items-center gap-2"
          >
            <span className="font-medium">This Week</span>
            <span className="text-black/60">▾</span>
          </button>

          {/* Start date box */}
          <button
            type="button"
            onClick={() => {
              setOpen(true)
              setActiveField('start')
            }}
            className={[
              'h-10 min-w-[130px] rounded-lg border border-black/10 bg-white px-3 text-sm hover:bg-black/[0.04] transition text-left',
              activeField === 'start' && open ? 'ring-2 ring-blue-500/40' : '',
            ].join(' ')}
          >
            {rangeStart ? pretty(rangeStart) : 'Start'}
          </button>

          <span className="text-black/50">-</span>

          {/* End date box */}
          <button
            type="button"
            onClick={() => {
              setOpen(true)
              setActiveField('end')
            }}
            className={[
              'h-10 min-w-[130px] rounded-lg border border-black/10 bg-white px-3 text-sm hover:bg-black/[0.04] transition text-left',
              activeField === 'end' && open ? 'ring-2 ring-blue-500/40' : '',
            ].join(' ')}
          >
            {rangeEnd ? pretty(rangeEnd) : 'End'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="w-full text-left rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none hover:bg-black/[0.04] transition flex items-center justify-between"
        >
          <span className={value ? 'text-black' : 'text-black/50'}>
            {value ? pretty(value) : placeholder}
          </span>
          <span className="text-black/50">📅</span>
        </button>
      )}

      {/* ✅ Render into body so it never hides behind dashboard widgets */}
      {typeof document !== 'undefined' && popover ? createPortal(popover, document.body) : null}
    </div>
  )
}

/* ---------------- helpers ---------------- */

function buildMonthGridSunStart(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startDowSun0 = first.getDay() // Sun=0
  const start = new Date(year, month, 1 - startDowSun0)

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

function compareISO(a: string, b: string) {
  // lexical works for YYYY-MM-DD
  if (a === b) return 0
  return a < b ? -1 : 1
}

function pretty(iso: string) {
  const d = parseISO(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ---------- Presets (range mode) ---------- */

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function startOfWeek(d: Date, monday: boolean) {
  const x = startOfDay(d)
  const dow = x.getDay() // Sun=0
  if (!monday) return addDays(x, -dow)
  // Monday-start:
  const dowMon0 = (dow + 6) % 7 // Mon=0
  return addDays(x, -dowMon0)
}

function endOfWeek(d: Date, monday: boolean) {
  const s = startOfWeek(d, monday)
  return addDays(s, 6)
}

function presetThisWeek(now: Date, monday: boolean) {
  const s = startOfWeek(now, monday)
  const e = endOfWeek(now, monday)
  return { start: toISO(s), end: toISO(e) }
}

function presetLastWeek(now: Date, monday: boolean) {
  const sThis = startOfWeek(now, monday)
  const s = addDays(sThis, -7)
  const e = addDays(sThis, -1)
  return { start: toISO(s), end: toISO(e) }
}

function presetPastDays(now: Date, days: number) {
  const end = startOfDay(now)
  const start = addDays(end, -(days - 1))
  return { start: toISO(start), end: toISO(end) }
}

function presetThisMonth(now: Date) {
  const s = new Date(now.getFullYear(), now.getMonth(), 1)
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: toISO(s), end: toISO(e) }
}

function presetLastMonth(now: Date) {
  const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const e = new Date(now.getFullYear(), now.getMonth(), 0)
  return { start: toISO(s), end: toISO(e) }
}

function presetPastMonths(now: Date, months: number) {
  const end = startOfDay(now)
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1)
  return { start: toISO(start), end: toISO(end) }
}

function presetYTD(now: Date) {
  const s = new Date(now.getFullYear(), 0, 1)
  const e = startOfDay(now)
  return { start: toISO(s), end: toISO(e) }
}
