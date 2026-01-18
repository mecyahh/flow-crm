// /app/components/FlowDatePicker.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export default function FlowDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement | null>(null)

  const initial = useMemo(() => (value ? parseISODate(value) : new Date()), [value])
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth()) // 0-11

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return
      const t = e.target as Node
      if (anchorRef.current && !anchorRef.current.contains(t)) set
