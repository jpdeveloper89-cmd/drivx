export default function CommunityPage() {
  const stats = [
    { label: 'Total Drivers', value: '12,847', delta: '+847 this month', positive: true },
    { label: 'Verified Trips', value: '1,241,093', delta: '+48,200 this week', positive: true },
    { label: 'Total Distance', value: '48.2M km', delta: 'equiv. 1,205 Earth orbits', positive: true },
    { label: 'DVX Distributed', value: '2.4M DVX', delta: 'to 12,847 drivers', positive: true },
    { label: 'CO₂ Saved (est.)', value: '1,240 tonnes', delta: 'vs. average driving', positive: true },
    { label: 'Avg Score Improvement', value: '+67 pts', delta: 'after first 10 trips', positive: true },
  ];

  const milestones = [
    { phase: 'Phase 1 — Q3 2026', title: 'Foundation', icon: '📱', desc: 'Mobile app live (iOS + Android). Auto-detection, scoring, trip history. Build driver base. No crypto visible.' },
    { phase: 'Phase 2 — Q4 2026', title: 'Token Launch', icon: '💎', desc: 'DVX deployed via Bankr Bot on Base. Revenue Distributor, Staking, Buyback contracts live. Trip rewards enabled. Early contributor bonus active.' },
    { phase: 'Phase 3 — Q1 2027', title: 'Insurance Integration', icon: '🛡️', desc: 'Verification API live. First insurer partnerships. Drivers unlock premium discounts from their Safety Score. Consent management active.' },
    { phase: 'Phase 4 — Q2 2027', title: 'Marketplace & Scale', icon: '🗺️', desc: 'Direct-hire delivery marketplace. Accountability Engine and public dashboard. Infrastructure APIs. Government data licensing.' },
    { phase: 'Phase 5 — Q3 2027+', title: 'Trustless Infrastructure', icon: '🔐', desc: 'ZK score proofs. Verifiable computation via zkVM. On-device federated scoring. Sybil-resistant driving proofs.' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-8 py-16">
      <div className="mb-10">
        <div className="section-tag">Network</div>
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#fafafa' }}>Community & Impact</h1>
        <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>
          Aggregate safety improvements and network growth across the DrivX Protocol community.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-16">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl p-5 border"
            style={{ background: '#111113', borderColor: '#27272a' }}>
            <div className="text-2xl font-bold mb-1" style={{ color: '#fafafa' }}>{s.value}</div>
            <div className="text-sm font-medium mb-1" style={{ color: '#fafafa' }}>{s.label}</div>
            <div className="text-xs" style={{ color: s.positive ? '#34d399' : '#f87171' }}>{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Roadmap timeline */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-8" style={{ color: '#fafafa' }}>Protocol Roadmap</h2>
        <div className="relative pl-8 border-l space-y-8" style={{ borderColor: '#27272a' }}>
          {milestones.map((m, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-11 top-2 w-3 h-3 rounded-full border-2"
                style={{ borderColor: '#6366f1', background: '#09090b' }} />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.15)' }}>
                  {m.icon}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#6366f1' }}>{m.phase}</div>
                  <div className="font-semibold mb-1" style={{ color: '#fafafa' }}>{m.title}</div>
                  <div className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>{m.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety improvement */}
      <div className="rounded-2xl p-8 text-center"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(34,211,238,0.1))', border: '1px solid rgba(99,102,241,0.3)' }}>
        <div className="text-5xl mb-4">🌍</div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: '#fafafa' }}>Roads are getting safer</h2>
        <p className="max-w-xl mx-auto text-sm leading-relaxed mb-8" style={{ color: '#a1a1aa' }}>
          Drivers on DrivX Protocol show an average 23% reduction in harsh braking events
          and 31% reduction in phone usage while driving after 30 trips.
        </p>
        <div className="grid grid-cols-3 gap-6">
          {[
            { label: 'Fewer harsh brakes', value: '-23%' },
            { label: 'Less phone use', value: '-31%' },
            { label: 'Score improvement', value: '+67pts' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold" style={{ color: '#22d3ee' }}>{s.value}</div>
              <div className="text-sm mt-1" style={{ color: '#a1a1aa' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
