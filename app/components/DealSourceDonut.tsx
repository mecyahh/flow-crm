'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip)

const SOURCE_ORDER = ['Inbound', 'Readymode', 'Referral', 'Warm-Market'] as const
type SourceName = (typeof SOURCE_ORDER)[number]

export default function DealSourceDonut({
  labels,
  values,
  glow = false,
}: {
  labels: string[]
  values: number[]
  glow?: boolean
}) {
  // ✅ lock colors to your sources in the same order
  const colorBySource: Record<SourceName, string> = useMemo(
    () => ({
      Inbound: '#3700FF', // Electric Indigo
      Readymode: '#44FF07', // Harlequin Green
      Referral: '#FB13F3', // Neon Fuchsia
      'Warm-Market': '#FF6B45', // Bright Orange
    }),
    []
  )

  // ✅ normalize incoming props into a map (handles unsorted labels)
  const sourceMap = useMemo(() => {
    const m = new Map<string, number>()
    ;(labels || []).forEach((raw, i) => {
      const k = String(raw || '').trim()
      if (!k) return
      const v = Number(values?.[i] ?? 0) || 0
      m.set(k, (m.get(k) || 0) + v)
    })
    return m
  }, [labels, values])

  // ✅ build final series in your order (and ONLY your sources)
  const safeLabels = useMemo(() => {
    return SOURCE_ORDER.slice()
  }, [])

  const safeValues = useMemo(() => {
    return SOURCE_ORDER.map((s) => Number(sourceMap.get(s) || 0))
  }, [sourceMap])

  const totalDeals = useMemo(() => safeValues.reduce((a, b) => a + b, 0) || 0, [safeValues])

  const top = useMemo(() => {
    let max = -Infinity
    let idx = 0
    safeValues.forEach((v, i) => {
      if (v > max) {
        max = v
        idx = i
      }
    })
    const pct = totalDeals ? Math.round((safeValues[idx] / totalDeals) * 100) : 0
    return { idx, name: safeLabels[idx] ?? '—', pct, count: safeValues[idx] ?? 0 }
  }, [safeLabels, safeValues, totalDeals])

  // ✅ small “pop” when top source changes
  const [pop, setPop] = useState(false)
  const prevTopNameRef = useRef<string>('')

  useEffect(() => {
    const prev = prevTopNameRef.current
    if (prev && prev !== top.name) {
      setPop(true)
      const t = setTimeout(() => setPop(false), 360)
      return () => clearTimeout(t)
    }
    prevTopNameRef.current = top.name
  }, [top.name])

  const data = useMemo(() => {
    const colors = safeLabels.map((s) => colorBySource[s as SourceName])

    // if everything is 0, show a “No Data” ring to avoid weird chart behavior
    const hasAny = safeValues.some((v) => v > 0)
    return {
      labels: hasAny ? safeLabels : ['No Data'],
      datasets: [
        {
          data: hasAny ? safeValues : [100],
          backgroundColor: hasAny ? colors : ['rgba(255,255,255,0.08)'],
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
          hoverOffset: 8,
          cutout: '72%',
        },
      ],
    }
  }, [safeLabels, safeValues, colorBySource])

  const glowPlugin = useMemo(() => {
    return {
      id: 'flowGlow',
      beforeDatasetDraw(chart: any) {
        if (!glow) return
        const ctx = chart.ctx
        ctx.save()
        ctx.shadowBlur = 18
        ctx.shadowColor = 'rgba(255,255,255,0.12)'
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
      },
      afterDatasetDraw(chart: any) {
        if (!glow) return
        chart.ctx.restore()
      },
    }
  }, [glow])

  const options: any = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 650, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          displayColors: false,
          backgroundColor: 'rgba(17,24,39,0.92)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255,255,255,0.10)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: (items: any) => `Deal Source: ${items?.[0]?.label ?? ''}`,
            // ✅ two lines, stacked
            label: (item: any) => {
              const dealsClosed = Number(item?.raw ?? 0)
              const total = (item?.dataset?.data || []).reduce(
                (s: number, x: any) => s + (Number(x) || 0),
                0
              )
              const pct = total ? Math.round((dealsClosed / total) * 100) : 0
              return [`Deals Closed: ${dealsClosed}`, `Percentage of Business: ${pct}%`]
            },
          },
        },
      },
    }
  }, [])

  return (
    <div className="h-56 w-full relative">
      <Doughnut data={data} options={options} plugins={glow ? [glowPlugin] : undefined} />

      {/* center overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
        <div className="text-[11px] text-white/60">Top Source</div>
        <div className="text-lg font-semibold truncate max-w-[240px]">{top.name}</div>

        <div
          className="text-xs font-semibold mt-1"
          style={{
            color: 'rgba(255,255,255,0.9)',
            transform: pop ? 'scale(1.12)' : 'scale(1)',
            transition: 'transform 360ms ease-out',
          }}
        >
          {top.pct}% • {top.count}
        </div>
      </div>
    </div>
  )
}
