'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import FlowDatePicker from '@/app/components/FlowDatePicker'

export default function FlowDateTimePicker({
  value,
  onChange,
  placeholder = 'Select date/time',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const initialISO = useMemo(() => (value ? value : ''), [value])
  const [date, setDate] = useState<string>(() => (initialISO ? isoToDate(initialISO) : ''))
  const [time, setTime] = useState<string>(() => (initialISO ? isoToTime(initialISO) : '09:00'))

  useEffect(() => {
    if (!value) return
    setDate(isoToDate(value))
    setTime(isoToTime(value))
  }, [value])

  useEffect(() => {
    if (!date) {
      onChange('')
      return
    }
    onChange(buildUTCISO(date, time || '09:00'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <FlowDatePicker value={date} onChange={setDate} placeholder={placeholder} />
      <TimePicker value={time} onChange={setTime} />
    </div>
  )
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const slots = useMemo(() => buildTimeSlots(), [])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return
      const t = e.target as Node
      if (anchorRef.current && !anchorRef.current.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="relative" ref={anchorRef}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full text-left rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none hover:bg-white/7 transition flex items-center justify-between"
      >
        <span className={value ? 'text-white' : 'text-white/50'}>{value || 'Select time'}</span>
        <span className="text-white/50">🕒</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-2xl border border-white/10 bg-[#0b0f1a]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="max-h-[280px] overflow-auto p-2">
            {slots.map((t) => {
              const active = t === value
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onChange(t)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-xl text-sm border transition',
                    active
                      ? 'bg-blue-600 border-blue-500/60 text-white'
                      : 'bg-white/5 border-white/10 hover:bg-white/10',
                  ].join(' ')}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function buildTimeSlots() {
  const out: string[] = []
  for (let h = 7; h <= 21; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return out
}

function isoToDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoToTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '09:00'
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function buildUTCISO(date: string, time: string) {
  const [yy, mm, dd] = date.split('-').map((x) => Number(x))
  const [hh, mi] = time.split(':').map((x) => Number(x))
  const d = new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1, hh || 0, mi || 0, 0))
  return d.toISOString()
}
