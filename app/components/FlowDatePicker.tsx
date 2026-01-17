'use client'

import { useMemo, useState } from 'react'
import FlowDatePicker from './FlowDatePicker'

const TIMES = [
  '08:00', '08:30',
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00', '17:30',
  '18:00', '18:30',
]

export default function FlowDateTimePicker({
  value,
  onChange,
  placeholder = 'Select date/time',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [date, setDate] = useState(() => (value ? value.split('T')[0] : ''))
  const [time, setTime] = useState(() => {
    if (!value) return ''
    const t = value.split('T')[1] || ''
    return t.slice(0, 5)
  })

  useMemo(() => {
    // keep internal state synced if parent changes
    if (!value) return
  }, [value])

  function commit(nextDate: string, nextTime: string) {
    if (!nextDate || !nextTime) {
      onChange('')
      return
    }
    onChange(`${nextDate}T${nextTime}:00.000Z`)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <FlowDatePicker
        value={date}
        onChange={(v) => {
          setDate(v)
          commit(v, time)
        }}
        placeholder={placeholder}
      />

      <div className="relative">
        <select
          value={time}
          onChange={(e) => {
            const v = e.target.value
            setTime(v)
            commit(date, v)
          }}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none hover:bg-white/7 transition"
        >
          <option value="">Select time</option>
          {TIMES.map((t) => (
            <option key={t} value={t}>
              {to12h(t)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function to12h(t: string) {
  const [hh, mm] = t.split(':').map(Number)
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const h = ((hh + 11) % 12) + 1
  return `${h}:${String(mm).padStart(2, '0')} ${ampm}`
}
