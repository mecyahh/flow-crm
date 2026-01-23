// ✅ REPLACE ENTIRE FILE: /app/components/CarrierDonut.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip)

export default function CarrierDonut({
  labels,
  values,
  glow = false,
  colors,
}: {
  labels: string[]
  values: number[]
  glow?: boolean
  colors?: string[]
}) {
  const safeLabels = labels.length ? labels : ['No Data']
  const safeValues = values.length ? values : [100]

  const top = useMemo(() => {
  const total = safeValues.reduce((a, b) => a + b, 0) || 1

  // sort indices by value desc
  const indices = safeValues
    .map((v, i) => ({ v: Number(v || 0), i }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.i)

  const topIdx = indices[0] ?? 0
  const topVal = safeValues[topIdx] ?? 0
  const pct = Math.round((Number(topVal || 0) / total) * 100)

  const color = palette[topIdx % palette.length]

  const top3 = indices.slice(0, 3).map((i) => {
    const v = Number(safeValues[i] || 0)
    const p = Math.round((v / total) * 100)
    return {
      idx: i,
      name: safeLabels[i] ?? '—',
      value: v,
      pct: p,
      color: palette[i % palette.length],
    }
  })

  return { name: safeLabels[topIdx] ?? '—', pct, color, top3 }
}, [safeLabels, safeValues, palette])

  const [pctAnim, setPctAnim] = useState(0)

useEffect(() => {
  const target = Number(top.pct || 0)
  const from = pctAnim
  const start = performance.now()
  const dur = 650 // ms

  let raf = 0
  const tick = (t: number) => {
    const p = Math.min(1, (t - start) / dur)
    // easeOutCubic
    const eased = 1 - Math.pow(1 - p, 3)
    const next = Math.round(from + (target - from) * eased)
    setPctAnim(next)
    if (p < 1) raf = requestAnimationFrame(tick)
  }

  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [top.pct])

  // ✅ Default palette = your requested colors (in order)
// Kelly green, Fuchsia, Red, Orange, Blue, Teal
const defaultPalette = ['#4CBB17', '#FF00FF', '#EF4444', '#F97316', '#3B82F6', '#14B8A6']

// allow override from parent
const palette = (colors && colors.length ? colors : defaultPalette).slice()

  const data = useMemo(() => {
  return {
    labels: safeLabels,
    datasets: [
      {
        data: safeValues,
        backgroundColor: safeValues.map((_, i) => palette[i % palette.length]),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        hoverOffset: 8,
        cutout: '72%',
      },
    ],
  }
}, [safeLabels, safeValues, palette])

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
            title: (items: any) => `${items?.[0]?.label ?? ''}`,
            label: (item: any) => `Count: ${item?.formattedValue ?? ''}`,
          },
        },
      },
    }
  }, [])

  return (
    <div className="h-56 w-full relative">
      <Doughnut data={data} options={options} plugins={glow ? [glowPlugin] : undefined} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4">
  <div className="text-xs text-white/60">Top Carrier</div>

  <div className="text-lg font-semibold text-center truncate max-w-[260px]">
    {top.name}
  </div>

  {/* ✅ animated % that matches top slice color */}
  <div className="text-xs font-semibold mt-1" style={{ color: top.color }}>
    {pctAnim}%
  </div>

  {/* ✅ rank badges (top 3) */}
  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
    {top.top3.map((x, idx) => (
      <div
        key={`${x.name}_${idx}`}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 backdrop-blur px-2.5 py-1"
        style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}
      >
        <span
          className="text-[10px] font-extrabold rounded-lg px-1.5 py-0.5"
          style={{ background: x.color, color: 'rgba(0,0,0,0.85)' }}
        >
          #{idx + 1}
        </span>

        <span className="text-[11px] font-semibold text-white/85 max-w-[120px] truncate">
          {x.name}
        </span>

        <span className="text-[11px] font-semibold" style={{ color: x.color }}>
          {x.pct}%
        </span>
      </div>
    ))}
  </div>
</div>
      </div>
    </div>
  )
}
