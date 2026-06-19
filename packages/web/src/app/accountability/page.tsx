const reports = [
  { id: '1', platform: 'QuickDeliver', period: 'Apr 2026', dataPoints: 1240, avgRequiredSpeed: 67.4, postedLimit: 60, overLimitPct: 12.3, severity: 'warning' as const, publishedAt: '2026-05-01' },
  { id: '2', platform: 'FastFood Express', period: 'Mar–Apr 2026', dataPoints: 2891, avgRequiredSpeed: 78.2, postedLimit: 60, overLimitPct: 30.3, severity: 'critical' as const, publishedAt: '2026-05-03' },
  { id: '3', platform: 'CityCourier', period: 'Apr 2026', dataPoints: 543, avgRequiredSpeed: 58.1, postedLimit: 60, overLimitPct: 0, severity: 'safe' as const, publishedAt: '2026-05-05' },
  { id: '4', platform: 'RushRiders', period: 'Apr 2026', dataPoints: 876, avgRequiredSpeed: 68.8, postedLimit: 60, overLimitPct: 14.7, severity: 'warning' as const, publishedAt: '2026-05-06' },
];

const severityConfig = {
  critical: { label: 'Critical Safety Concern', color: '#dc2626', bg: 'rgba(220,38,38,0.15)', icon: '🚨' },
  warning: { label: 'Above Limit', color: '#f87171', bg: 'rgba(239,68,68,0.12)', icon: '⚠️' },
  safe: { label: 'Compliant', color: '#34d399', bg: 'rgba(16,185,129,0.12)', icon: '✅' },
};

export default function AccountabilityPage() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-16">
      <div className="mb-10">
        <div className="section-tag">Transparency</div>
        <h1 className="text-3xl font-bold tracking-tight mb-3" style={{ color: '#fafafa' }}>Platform Accountability</h1>
        <p className="max-w-2xl text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>
          Published reports on delivery platforms based on anonymised trip data from opted-in drivers.
          Reports are immutable on-chain records. Minimum 50 unique drivers required before publishing.
        </p>
      </div>

      {/* Critical alert */}
      {reports.some((r) => r.severity === 'critical') && (
        <div className="rounded-xl p-5 mb-8 flex items-start gap-3 border"
          style={{ background: 'rgba(220,38,38,0.1)', borderColor: 'rgba(220,38,38,0.3)' }}>
          <span className="text-2xl">🚨</span>
          <div>
            <div className="font-semibold mb-1" style={{ color: '#f87171' }}>Critical Safety Concern detected</div>
            <div className="text-sm" style={{ color: '#fca5a5' }}>
              One or more platforms require drivers to travel &gt;20% above posted speed limits.
              This poses a serious risk to drivers and the public.
            </div>
          </div>
        </div>
      )}

      {/* Reports */}
      <div className="space-y-4">
        {reports.map((r) => {
          const cfg = severityConfig[r.severity];
          return (
            <div key={r.id} className="rounded-xl p-6 border transition-all"
              style={{ background: '#111113', borderColor: '#27272a' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{cfg.icon}</span>
                    <h3 className="font-semibold" style={{ color: '#fafafa' }}>{r.platform}</h3>
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-sm" style={{ color: '#a1a1aa' }}>
                    Period: {r.period} · {r.dataPoints.toLocaleString()} data points · Published {r.publishedAt}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: r.overLimitPct > 0 ? cfg.color : '#34d399' }}>
                    {r.overLimitPct > 0 ? `+${r.overLimitPct}%` : 'Compliant'}
                  </div>
                  <div className="text-xs" style={{ color: '#a1a1aa' }}>over posted limit</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { label: 'Avg required speed', value: `${r.avgRequiredSpeed} km/h` },
                  { label: 'Posted limit', value: `${r.postedLimit} km/h` },
                  { label: 'Data points', value: r.dataPoints.toLocaleString() },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg p-3" style={{ background: '#0f0f11' }}>
                    <div className="font-semibold" style={{ color: '#fafafa' }}>{s.value}</div>
                    <div className="text-xs mt-1" style={{ color: '#a1a1aa' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs mt-8 text-center" style={{ color: '#a1a1aa' }}>
        All reports published on-chain · k-anonymity enforced (min 50 unique drivers) · Updated weekly
      </p>
    </div>
  );
}
