'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type DealRow = {
  id: string
  created_at: string
  agent_id: string | null
  premium: number | null
  company: string | null
}

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isoDay(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function inDay(iso: string, dayISO: string) {
  // created_at is ISO timestamp; match date prefix
  return iso?.slice(0, 10) === dayISO
}

function nameOf(p?: ProfileRow | null) {
  const n = `${p?.first_name || ''} ${p?.last_name || ''}`.trim()
  return n || p?.email || 'Agent'
}

export default function DashboardPage() {
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [me, setMe] = useState<ProfileRow | null>(null)
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({})

  const [deals, setDeals] = useState<DealRow[]>([])
  const [dayPick, setDayPick] = useState<string>(isoDay(new Date()))

  // goal values (admin editable later)
  const [weeklyGoal, setWeeklyGoal] = useState<number>(25000)
  const [monthlyGoal, setMonthlyGoal] = useState<number>(100000)

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setLoading(true)

    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id || null

    if (uid) {
      const { data: myProf } = await supabase.from('profiles').select('id, first_name, last_name, email').eq('id', uid).single()
      if (myProf) setMe(myProf as ProfileRow)
    }

    const { data: profs, error: pErr } = await supabase.from('profiles').select('id, first_name, last_name, email').limit(5000)
    if (pErr) setToast('Could not load profiles (RLS)')
    const map: Record<string, ProfileRow> = {}
    ;(profs || []).forEach((r: any) => (map[r.id] = r))
    setProfiles(map)

    const since = new Date()
    since.setDate(since.getDate() - 45) // enough window for dashboard + leaderboard preview
    const { data: d, error: dErr } = await supabase
      .from('deals')
      .select('id, created_at, agent_id, premium, company')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)

    if (dErr) setToast('Could not load deals (RLS)')
    setDeals((d || []) as DealRow[]
