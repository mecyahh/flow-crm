"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Deal = {
  id: string;
  created_at: string;
  premium: string | null;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [name, setName] = useState("Flow");

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      // Pull last 30 days of deals for quick metrics
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data, error } = await supabase
        .from("deals")
        .select("id,created_at,premium")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      if (!error && data) setDeals(data as Deal[]);

      setLoading(false);
    })();
  }, []);

  const metrics = useMemo(() => {
    const today = startOfToday();
    const week = startOfWeek();
    const month = startOfMonth();

    let todayCount = 0,
      weekCount = 0,
      monthCount = 0;

    let todayPremium = 0,
      weekPremium = 0,
      monthPremium = 0;

    for (const d of deals) {
      const t = new Date(d.created_at);
      const prem = Number(d.premium || 0) || 0;

      if (t >= today) {
        todayCount++;
        todayPremium += prem;
      }
      if (t >= week) {
        weekCount++;
        weekPremium += prem;
      }
      if (t >= month) {
        monthCount++;
        monthPremium += prem;
      }
    }

    return {
      todayCount,
      weekCount,
      monthCount,
      todayPremium,
      weekPremium,
      monthPremium,
    };
  }, [deals]);

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        Loading Flow…
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>{name} Dashboard</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <a href="/post-deal" style={btnStyle}>Post a Deal</a>
          <button style={btnStyle}>Notifications</button>
        </div>
      </div>

      {/* KPI widgets */}
      <div style={gridStyle}>
        <div style={cardStyle}>
          <div style={labelStyle}>Today</div>
          <div style={bigStyle}>{metrics.todayCount} deals</div>
          <div style={subStyle}>Premium: ${metrics.todayPremium.toFixed(2)}</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>This Week</div>
          <div style={bigStyle}>{metrics.weekCount} deals</div>
          <div style={subStyle}>Premium: ${metrics.weekPremium.toFixed(2)}</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>This Month</div>
          <div style={bigStyle}>{metrics.monthCount} deals</div>
          <div style={subStyle}>Premium: ${metrics.monthPremium.toFixed(2)}</div>
        </div>
      </div>

      {/* Trend + Leaderboard placeholders */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Flow Trend (30 days)</div>
          <div style={{ height: 220, display: "grid", placeItems: "center", opacity: 0.7 }}>
            Trend chart goes here (stock-style)
          </div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Leaderboard</div>
          <div style={{ marginTop: 10, opacity: 0.7 }}>
            Top agents will show here after we add profiles + teams.
          </div>
        </div>
      </div>
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 16,
  marginTop: 16,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  backdropFilter: "blur(10px)",
};

const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.75 };
const bigStyle: React.CSSProperties = { fontSize: 26, fontWeight: 800, marginTop: 8 };
const subStyle: React.CSSProperties = { marginTop: 6, opacity: 0.8 };

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  textDecoration: "none",
};
