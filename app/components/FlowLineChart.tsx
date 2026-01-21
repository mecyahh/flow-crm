'use client'

import React, { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

export default function FlowLineChart({
  labels,
  values,
}: {
  labels: string[]
  values: number[]
}) {
  const trend = useMemo(() => {
    const last = values[values.length - 1] ?? 0
    const prev = values[values.length - 2] ?? last
    const delta = last - prev
    const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
    return { last, prev, delta, dir }
  }, [values])

  const colors = useMemo(() => {
    if (trend.dir === 'up') return { line: '#22C55E', fill: 'rgba(34,197,94,0.18)' }
    if (trend.dir === 'down') return { line: '#EF4444', fill: 'rgba(239,68,68,0.18)' }
    return { line: '#3B82F6', fill: 'rgba(59,130,246,0.18)' }
  }, [trend.dir])

  const data = useMemo(() => {
    return {
      labels,
      datasets: [
        {
          label: 'Flow',
          data: values,
          tension: 0.42,
          borderWidth: 2,
          borderColor: colors.line,
          pointRadius: 0,
          fill: true,
          backgroundColor: (ctx: any) => {
            const chart = ctx.chart
            const { ctx: canvasCtx, chartArea } = chart
            if (!chartArea) return colors.fill

            const g = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
            g.addColorStop(0, colors.fill)
            g.addColorStop(1, 'rgba(255,255,255,0)')
            return g
          },
        },
      ],
    }
  }, [labels, values, colors.fill, colors.line])

  const options: any = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
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
            title: (items: any) => `Flow • ${items?.[0]?.label ?? ''}`,
            label: (item: any) => `Deals: ${item?.formattedValue ?? ''}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255,255,255,0.55)' },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: 'rgba(255,255,255,0.55)', precision: 0 },
          beginAtZero: true,
        },
      },
    }
  }, [])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-[var(--text)]/60">Trend</div>
        <div
          className={`text-xs font-semibold ${
            trend.dir === 'up'
              ? 'text-green-400'
              : trend.dir === 'down'
              ? 'text-red-400'
              : 'text-blue-300'
          }`}
        >
          {trend.dir === 'up' ? '▲' : trend.dir === 'down' ? '▼' : '■'} {trend.delta}
        </div>
      </div>

      <div className="h-56 w-full">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
