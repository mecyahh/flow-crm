'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

export type GlassOption = {
  value: string
  label: string
  meta?: any
}

export default function GlassSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  className = '',
  maxMenuHeight = 260,
}: {
  label?: string
  value: string
  onChange: (v: string, opt?: GlassOption) => void
  options: GlassOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  maxMenuHeight?: number
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState<number>(-1)

  const selected = useMemo(() => options.find((o) => o.value === value) || null, [options, value])

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open) return
      const el = wrapRef.current
      if (!el) return
      if (!el.contains(e.target as any)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  // Reset active index when opening
  useEffect(() => {
    if (!open) return
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === value)
    )
    setActiveIdx(idx >= 0 ? idx : 0)

    // Scroll active into view after paint
    const t = window.setTimeout(() => scrollActiveIntoView(idx), 0)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function scrollActiveIntoView(idx: number) {
    const list = listRef.current
    if (!list) return
    const item = list.querySelector(`[data-idx="${idx}"]`) as HTMLElement | null
    if (!item) return
    const listRect = list.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    const overTop = itemRect.top < listRect.top
    const overBot = itemRect.bottom > listRect.bottom
    if (overTop) item.scrollIntoView({ block: 'nearest' })
    if (overBot) item.scrollIntoView({ block: 'nearest' })
  }

  function pick(idx: number) {
    const opt = options[idx]
    if (!opt) return
    onChange(opt.value, opt)
    setOpen(false)
    btnRef.current?.focus()
  }

  // Type-to-search buffer
  const typeRef = useRef<{ s: string; t: number }>({ s: '', t: 0 })

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return

    // Open with Enter/Space/ArrowDown
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
        return
      }
      return
    }

    // When open:
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(options.length - 1, (activeIdx < 0 ? 0 : activeIdx) + 1)
      setActiveIdx(next)
      scrollActiveIntoView(next)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(0, (activeIdx < 0 ? 0 : activeIdx) - 1)
      setActiveIdx(prev)
      scrollActiveIntoView(prev)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      pick(activeIdx)
      return
    }

    // Type to search
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now()
      const buf = typeRef.current
      if (now - buf.t > 650) buf.s = ''
      buf.t = now
      buf.s += e.key.toLowerCase()
      typeRef.current = buf

      const idx = options.findIndex((o) => o.label.toLowerCase().startsWith(buf.s))
      if (idx >= 0) {
        setActiveIdx(idx)
        scrollActiveIntoView(idx)
      }
    }
  }

  return (
    <div ref={wrapRef} className={['w-full', className].join(' ')}>
      {label ? <div className="text-[11px] text-white/55 mb-2">{label}</div> : null}

      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          disabled={disabled}
          onKeyDown={onKeyDown}
          onClick={() => {
            if (disabled) return
            setOpen((s) => !s)
          }}
          className={[
            // ✅ glass button (same vibe as your inputs)
            'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-left',
            'outline-none transition',
            'focus:border-white/20 focus:bg-white/7',
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/7',
            'text-white',
          ].join(' ')}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <div className="flex items-center justify-between gap-3">
            <span className={selected ? 'text-white' : 'text-white/45'}>{selected?.label || placeholder}</span>
            <span className="text-white/60 select-none">{open ? '▴' : '▾'}</span>
          </div>
        </button>

        {/* ✅ menu */}
        {open ? (
          <div
            className={[
              'absolute z-50 mt-2 w-full',
              'rounded-2xl border border-white/10',
              'bg-[rgba(11,15,26,0.88)] backdrop-blur-xl',
              'shadow-2xl overflow-hidden',
              'animate-[glassPop_140ms_ease-out]',
            ].join(' ')}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onKeyDown}
          >
            {/* subtle glow blobs */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -right-20 w-[220px] h-[220px] rounded-full bg-blue-500/10 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-[220px] h-[220px] rounded-full bg-white/5 blur-3xl" />
            </div>

            <div
              ref={listRef}
              className="relative max-h-[var(--h)] overflow-auto py-1"
              style={{ ['--h' as any]: `${maxMenuHeight}px` }}
            >
              {options.length === 0 ? (
                <div className="px-4 py-3 text-sm text-white/60">No options</div>
              ) : (
                options.map((opt, idx) => {
                  const isActive = idx === activeIdx
                  const isSelected = opt.value === value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      data-idx={idx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => pick(idx)}
                      className={[
                        'w-full text-left px-4 py-2.5 text-sm',
                        'transition flex items-center justify-between gap-3',
                        isActive ? 'bg-white/10' : 'bg-transparent',
                        'hover:bg-white/10',
                      ].join(' ')}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className={isSelected ? 'text-white font-semibold' : 'text-white/90'}>{opt.label}</span>
                      {isSelected ? <span className="text-white/60">✓</span> : <span className="text-white/0">✓</span>}
                    </button>
                  )
                })
              )}
            </div>

            <style jsx>{`
              @keyframes glassPop {
                from {
                  transform: translateY(-6px) scale(0.985);
                  opacity: 0;
                }
                to {
                  transform: translateY(0) scale(1);
                  opacity: 1;
                }
              }
            `}</style>
          </div>
        ) : null}
      </div>
    </div>
  )
}
