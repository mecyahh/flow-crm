'use client'

import React from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip)

export default function CarrierDonut() {
  const data = {
    labels: ['AIG', 'Mutual', 'Foresters', 'Other'],
    datasets: [
      {
        data: [38, 26, 22, 14], // mock data for now
        backgroundColor: [
          'rgba(59,130,246,0.85)',  // blue
          'rgba(34,197,94,0.85)',   // green
          'rgba(245,158,11,0.85)',  // amber
          'rgba(255,255,255,0.25)'  // neutral
        ],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        hoverOffset: 6,
        cutout: '70%',
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
  }

  return (
    <div className="h-56 w-full relative">
      <Doughnut data={data} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-xs text-white/60">Top Carrier</div>
        <div className="text-lg font-semibold">AIG</div>
      </div>
    </div>
  )
}
