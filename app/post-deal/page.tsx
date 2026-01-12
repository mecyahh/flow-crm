"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const relationships = ["spouse","child","parent","friend","sibling","other"] as const;

export default function PostDealPage() {
  const [sessionReady, setSessionReady] = useState(false);

  // form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [clientDob, setClientDob] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryRelationship, setBeneficiaryRelationship] = useState<(typeof relationships)[number]>("spouse");
  const [beneficiaryDob, setBeneficiaryDob] = useState("");
  const [coverage, setCoverage] = useState("");
  const [premium, setPremium] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = "/login";
        return;
      }
      setSessionReady(true);
    })();
  }, []);

  const submit = async () => {
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) return (window.location.href = "/login");

    const { error } = await supabase.from("deals").insert({
      agent_id: user.id,
      full_name: fullName,
      phone,
      client_dob: clientDob || null,
      beneficiary_name: beneficiaryName || null,
      beneficiary_relationship: beneficiaryRelationship || null,
      beneficiary_dob: beneficiaryDob || null,
      coverage: coverage ? Number(coverage) : null,
      premium: premium ? Number(premium) : null,
      company: company || null,
      notes: notes || null,
      status: "pending"
    });

    if (error) return setMsg(error.message);

    setMsg("✅ Deal submitted");
    setFullName(""); setPhone(""); setClientDob("");
    setBeneficiaryName(""); setBeneficiaryRelationship("spouse"); setBeneficiaryDob("");
    setCoverage(""); setPremium(""); setCompany(""); setNotes("");
  };

  if (!sessionReady) return null;

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Post a Deal</h1>

      <div style={{ display: "grid", gap: 10 }}>
        <input placeholder="Full name" value={fullName} onChange={(e)=>setFullName(e.target.value)} style={{ padding: 12 }} />
        <input placeholder="Phone" value={phone} onChange={(e)=>setPhone(e.target.value)} style={{ padding: 12 }} />

        <label>Client DOB</label>
        <input type="date" value={clientDob} onChange={(e)=>setClientDob(e.target.value)} style={{ padding: 12 }} />

        <hr />

        <input placeholder="Beneficiary name" value={beneficiaryName} onChange={(e)=>setBeneficiaryName(e.target.value)} style={{ padding: 12 }} />

        <label>Beneficiary relationship</label>
        <select value={beneficiaryRelationship} onChange={(e)=>setBeneficiaryRelationship(e.target.value as any)} style={{ padding: 12 }}>
          {relationships.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <label>Beneficiary DOB</label>
        <input type="date" value={beneficiaryDob} onChange={(e)=>setBeneficiaryDob(e.target.value)} style={{ padding: 12 }} />

        <hr />

        <input placeholder="Coverage" value={coverage} onChange={(e)=>setCoverage(e.target.value)} style={{ padding: 12 }} />
        <input placeholder="Premium" value={premium} onChange={(e)=>setPremium(e.target.value)} style={{ padding: 12 }} />
        <input placeholder="Company" value={company} onChange={(e)=>setCompany(e.target.value)} style={{ padding: 12 }} />
        <textarea placeholder="Notes" value={notes} onChange={(e)=>setNotes(e.target.value)} style={{ padding: 12, minHeight: 120 }} />

        <button onClick={submit} style={{ padding: 14, fontWeight: 700 }}>
          Submit Deal
        </button>

        {msg ? <p>{msg}</p> : null}
      </div>
    </div>
  );
}
