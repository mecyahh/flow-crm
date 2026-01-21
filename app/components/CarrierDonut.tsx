'use client'

import React, { useMemo } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip)

export default function CarrierDonut({
  labels,
  values,
}: {
  labels: string[]
  values: number[]
}) {
  const safeLabels = labels.length ? labels : ['No Data']
  const safeValues = values.length ? values : [100]

  const top = useMemo(() => {
    let max = -Infinity
    let idx = 0
    safeValues.forEach((v, i) => {
      if (v > max) {
        max = v
        idx = i
      }
    })
    const total = safeValues.reduce((a, b) => a + b, 0) || 1
    const pct = Math.round((safeValues[idx] / total) * 100)
    return { name: safeLabels[idx], pct }
  }, [safeLabels, safeValues])

  const palette = [
    'rgba(59,130,246,0.85)',  // blue
    'rgba(34,197,94,0.85)',   // green
    'rgba(245,158,11,0.85)',  // amber
    'rgba(255,255,255,0.22)', // neutral
    'rgba(14,165,233,0.75)',
    'rgba(16,185,129,0.75)',
    'rgba(249,115,22,0.75)',
  ]

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
  }, [safeLabels, safeValues])

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
      <Doughnut data={data} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-xs text-[var(--text)]/60">Top Carrier</div>
        <div className="text-lg font-semibold">{top.name}</div>
        <div className="text-xs font-semibold text-blue-300 mt-1">{top.pct}%</div>
      </div>
    </div>
  )
}
