// ✅ REPLACE ONLY THIS PODIUM SECTION inside /app/leaderboard/page.tsx
// Find:  {/* PODIUM */} ... up to the closing </div> of that podium grid
// Replace it with the block below.

{/* PODIUM */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
  {/* #2 LEFT */}
  {top3[1] ? (
    <div className="relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden p-6">
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/60">#2</div>
          <div className="text-xs text-white/60">Podium</div>
        </div>

        <div className="mt-3">
          <div className="text-xl font-bold">{top3[1].name}</div>
          <div className="mt-2 text-2xl font-extrabold">{money(top3[1].total)}</div>
        </div>
      </div>
    </div>
  ) : (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/50">No data</div>
  )}

  {/* #1 CENTER (bigger + gold spotlight) */}
  {top3[0] ? (
    <div className="relative rounded-2xl border border-white/15 bg-white/6 overflow-hidden p-7 lg:scale-[1.05] shadow-2xl">
      {/* GOLD SPOTLIGHT */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[380px] bg-yellow-400/20 blur-3xl rounded-full" />
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[420px] h-[240px] bg-yellow-300/18 blur-3xl rounded-full" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/60">#1</div>
          <div className="text-xs text-white/60">Podium</div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-extrabold tracking-tight">{top3[0].name}</div>
          <div className="mt-2 text-4xl font-black tracking-tight">{money(top3[0].total)}</div>
        </div>
      </div>
    </div>
  ) : (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/50">No data</div>
  )}

  {/* #3 RIGHT */}
  {top3[2] ? (
    <div className="relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden p-6">
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/60">#3</div>
          <div className="text-xs text-white/60">Podium</div>
        </div>

        <div className="mt-3">
          <div className="text-xl font-bold">{top3[2].name}</div>
          <div className="mt-2 text-2xl font-extrabold">{money(top3[2].total)}</div>
        </div>
      </div>
    </div>
  ) : (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/50">No data</div>
  )}
</div>
