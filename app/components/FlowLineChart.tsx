'use client'

import React from 'react'
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

export default function FlowLineChart() {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const values = [12, 18, 14, 22, 19, 27, 24] // mock data for now

  const data = {
    labels,
    datasets: [
      {
        label: 'Flow',
        data: values,
        tension: 0.4,
        borderWidth: 2,
        borderColor: '#3B82F6',
        pointRadius: 0,
        fill: true,
        backgroundColor: 'rgba(59,130,246,0.18)',
      },
    ],
  }

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
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
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(255,255,255,0.55)' },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: 'rgba(255,255,255,0.55)' },
      },
    },
  }

  return (
    <div className="h-56 w-full">
      <Line data={data} options={options} />
    </div>
  )
}
