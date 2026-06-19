import { ScoreRing } from '@/components/ScoreRing';

const leaderboard = [
  { rank: 1, handle: 'SafeDriver_Mumbai', score: 982, trips: 847, km: 12400, region: 'Mumbai, IN', verified: true },
  { rank: 2, handle: 'Anonymous Driver', score: 978, trips: 1200, km: 18900, region: 'São Paulo, BR', verified: true },
  { rank: 3, handle: 'CarefulCommuter', score: 971, trips: 634, km: 9800, region: 'London, UK', verified: true },
  { rank: 4, handle: 'Anonymous Driver', score: 968, trips: 412, km: 6200, region: 'Toronto, CA', verified: true },
  { rank: 5, handle: 'NightOwlDriver', score: 961, trips: 923, km: 14100, region: 'Chicago, US', verified: true },
  { rank: 6, handle: 'Anonymous Driver', score: 958, trips: 287, km: 4300, region: 'Berlin, DE', verified: true },
  { rank: 7, handle: 'SmoothOperator_DXB', score: 954, trips: 1089, km: 16700, region: 'Dubai, AE', verified: true },
  { rank: 8, handle: 'Anonymous Driver', score: 949, trips: 756, km: 11200, region: 'Sydney, AU', verified: true },
  { rank: 9, handle: 'QuiteCautious', score: 943, trips: 334, km: 5100, region: 'Singapore, SG', verified: true },
  { rank: 10, handle: 'Anonymous Driver', score: 939, trips: 678, km: 9900, region: 'Mexico City, MX', verified: true },
];

export default function LeaderboardPage() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-16">
      <div className="mb-10">
        <div className="section-tag">Community</div>
        <h1 className="section-title">Safety Leaderboard</h1>
        <p className="text-muted max-w-xl">
          Top drivers by Safety Score globally. Anonymised by default — opt in via the app to show your handle.
        </p>
      </div>

      <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
        {['All Regions', 'Asia', 'Europe', 'Americas', 'Middle East', 'Africa'].map((r) => (
          <button key={r} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors ${
            r === 'All Regions'
              ? 'bg-accent border-accent text-white'
              : 'border-border text-muted hover:text-text hover:border-text'
          }`}>
            {r}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden" style={{ background: '#111113' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-xs text-muted uppercase tracking-widest">
              <th className="text-left py-4 px-6">Rank</th>
              <th className="text-left py-4 px-6">Driver</th>
              <th className="text-left py-4 px-6">Safety Score</th>
              <th className="text-left py-4 px-6 hidden sm:table-cell">Trips</th>
              <th className="text-left py-4 px-6 hidden md:table-cell">Distance</th>
              <th className="text-left py-4 px-6 hidden lg:table-cell">Region</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((d) => (
              <tr key={d.rank} className="border-b border-border hover:bg-white/5 transition-colors">
                <td className="py-4 px-6">
                  <span className={`font-bold text-lg ${d.rank <= 3 ? '' : 'text-muted'}`}
                    style={d.rank <= 3 ? { color: '#6366f1' } : {}}>
                    {d.rank <= 3 ? ['🥇', '🥈', '🥉'][d.rank - 1] : `#${d.rank}`}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
                      {d.handle[0]}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-text">{d.handle}</div>
                      {d.verified && <span className="text-xs" style={{ color: '#22d3ee' }}>✓ Verified</span>}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <ScoreRing score={d.score} size={36} />
                    <span className="font-bold text-text">{d.score}</span>
                  </div>
                </td>
                <td className="py-4 px-6 hidden sm:table-cell text-muted text-sm">{d.trips.toLocaleString()}</td>
                <td className="py-4 px-6 hidden md:table-cell text-muted text-sm">{d.km.toLocaleString()} km</td>
                <td className="py-4 px-6 hidden lg:table-cell text-muted text-sm">{d.region}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted mt-4 text-center">
        Showing top 10 globally · Updated every 24 hours · Minimum 10 verified trips to qualify
      </p>
    </div>
  );
}
