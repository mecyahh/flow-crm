'use client'

import React, { useMemo } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip)

type GoalProps = {
  title: string
  current: number
  goal: number
  accent?: 'blue' | 'green'
}

export default function GoalDonuts({
  weeklyCurrent,
  weeklyGoal,
  monthlyCurrent,
  monthlyGoal,
}: {
  weeklyCurrent: number
  weeklyGoal: number
  monthlyCurrent: number
  monthlyGoal: number
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <GoalDonut title="Weekly Goal" current={weeklyCurrent} goal={weeklyGoal} accent="blue" />
      <GoalDonut title="Monthly Goal" current={monthlyCurrent} goal={monthlyGoal} accent="blue" />
    </div>
  )
}

function GoalDonut({ title, current, goal, accent = 'blue' }: GoalProps) {
  const pct = useMemo(() => {
    const g = goal <= 0 ? 1 : goal
    return Math.max(0, Math.min(100, Math.round((current / g) * 100)))
  }, [current, goal])

  const accentColor = accent === 'green' ? 'rgba(34,197,94,0.90)' : 'rgba(59,130,246,0.90)'
  const trackColor = 'rgba(255,255,255,0.10)'

  const data = useMemo(() => {
    return {
      labels: ['Progress', 'Remaining'],
      datasets: [
        {
          data: [pct, 100 - pct],
          backgroundColor: [accentColor, trackColor],
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
          cutout: '78%',
          hoverOffset: 2,
        },
      ],
    }
  }, [pct, accentColor])

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
          callbacks: {
            title: () => title,
            label: () => `${current} / ${goal} (${pct}%)`,
          },
        },
      },
    }
  }, [title, current, goal, pct])

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-[var(--text)]/60">
          {current} / {goal}
        </div>
      </div>

      <div className="h-40 relative">
        <Doughnut data={data} options={options} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-semibold tracking-tight">{pct}%</div>
          <div className="text-xs text-[var(--text)]/60">Complete</div>
        </div>
      </div>
    </div>
  )
}
