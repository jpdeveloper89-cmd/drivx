export function StatsBar() {
  const stats = [
    { label: 'Active Drivers', value: '12,847' },
    { label: 'Verified Trips', value: '1.2M' },
    { label: 'Total Distance', value: '48M km' },
    { label: 'DVX Distributed', value: '2.4M' },
    { label: 'Avg Safety Score', value: '823' },
  ];

  return (
    <div className="border-y border-border">
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold tracking-tight text-text">{s.value}</div>
              <div className="text-xs text-muted uppercase tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
