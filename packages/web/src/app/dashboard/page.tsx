'use client';
import { useState } from 'react';
import { ScoreRing } from '@/components/ScoreRing';

const drivers = [
  { address: '0x1a2b...3c4d', score: 934, trips: 847, deliveries: 412, onTimeRate: 97, zone: 'Mumbai Central', category: 'food', available: true, fee: 12 },
  { address: '0x5e6f...7g8h', score: 891, trips: 623, deliveries: 298, onTimeRate: 94, zone: 'Bandra West', category: 'grocery', available: true, fee: 10 },
  { address: '0x9i0j...1k2l', score: 876, trips: 1102, deliveries: 634, onTimeRate: 96, zone: 'Andheri East', category: 'package', available: false, fee: 11 },
  { address: '0x3m4n...5o6p', score: 854, trips: 445, deliveries: 187, onTimeRate: 91, zone: 'Dadar', category: 'food', available: true, fee: 9 },
  { address: '0x7q8r...9s0t', score: 921, trips: 789, deliveries: 501, onTimeRate: 98, zone: 'Powai', category: 'pharmacy', available: true, fee: 14 },
];

const categories = ['All', 'food', 'grocery', 'package', 'pharmacy'];

export default function DashboardPage() {
  const [minScore, setMinScore] = useState(800);
  const [category, setCategory] = useState('All');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const filtered = drivers.filter((d) => {
    if (d.score < minScore) return false;
    if (category !== 'All' && d.category !== category) return false;
    if (onlyAvailable && !d.available) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-8 py-16">
      {/* Header */}
      <div className="mb-10 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="section-tag">Business Portal</div>
          <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: '#fafafa' }}>Driver Marketplace</h1>
          <p style={{ color: '#a1a1aa' }}>Find and hire verified safe drivers for your deliveries.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary text-sm">📄 Invoices</button>
          <button className="btn-primary text-sm">+ Post Job</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Active Jobs', value: '3', icon: '📦' },
          { label: 'Completed (30d)', value: '47', icon: '✅' },
          { label: 'Total Spend (30d)', value: '₹ 24,800', icon: '💳' },
          { label: 'Avg Driver Score', value: '895', icon: '⭐' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-5 border flex items-center gap-4"
            style={{ background: '#111113', borderColor: '#27272a' }}>
            <span className="text-3xl">{s.icon}</span>
            <div>
              <div className="text-2xl font-bold" style={{ color: '#fafafa' }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: '#a1a1aa' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border p-5 mb-6"
        style={{ background: '#111113', borderColor: '#27272a' }}>
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: '#a1a1aa' }}>
              Min Safety Score
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={500} max={1000} step={10} value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-32" style={{ accentColor: '#6366f1' }}
              />
              <span className="font-bold w-10" style={{ color: '#6366f1' }}>{minScore}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-2 uppercase tracking-widest" style={{ color: '#a1a1aa' }}>
              Category
            </label>
            <div className="flex gap-2 flex-wrap">
              {categories.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className="px-3 py-1.5 rounded-lg text-sm capitalize transition-colors border"
                  style={category === c
                    ? { background: '#6366f1', color: '#fff', borderColor: '#6366f1' }
                    : { background: 'transparent', color: '#a1a1aa', borderColor: '#27272a' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="available" checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              style={{ accentColor: '#6366f1' }} />
            <label htmlFor="available" className="text-sm" style={{ color: '#a1a1aa' }}>Available now only</label>
          </div>
          <div className="ml-auto text-sm" style={{ color: '#a1a1aa' }}>
            {filtered.length} driver{filtered.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      {/* Driver table */}
      <div className="rounded-xl border overflow-hidden"
        style={{ background: '#111113', borderColor: '#27272a' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b text-xs uppercase tracking-widest"
              style={{ borderColor: '#27272a', background: '#0f0f11', color: '#a1a1aa' }}>
              <th className="text-left py-4 px-6">Driver</th>
              <th className="text-left py-4 px-6">Safety Score</th>
              <th className="text-left py-4 px-6 hidden sm:table-cell">Deliveries</th>
              <th className="text-left py-4 px-6 hidden md:table-cell">On-time</th>
              <th className="text-left py-4 px-6 hidden lg:table-cell">Zone</th>
              <th className="text-left py-4 px-6">Status</th>
              <th className="text-right py-4 px-6">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm" style={{ color: '#a1a1aa' }}>
                  No drivers match your filters. Try lowering the minimum score.
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.address} className="border-b transition-colors"
                  style={{ borderColor: '#1f1f22' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#18181b')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td className="py-4 px-6">
                    <div className="font-mono text-sm" style={{ color: '#22d3ee' }}>{d.address}</div>
                    <div className="text-xs mt-0.5 capitalize" style={{ color: '#a1a1aa' }}>
                      {d.category} specialist · {d.trips} trips
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <ScoreRing score={d.score} size={36} />
                      <span className="font-bold" style={{ color: '#fafafa' }}>{d.score}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 hidden sm:table-cell text-sm" style={{ color: '#a1a1aa' }}>{d.deliveries}</td>
                  <td className="py-4 px-6 hidden md:table-cell">
                    <span className="text-sm font-medium"
                      style={{ color: d.onTimeRate >= 95 ? '#34d399' : '#fb923c' }}>
                      {d.onTimeRate}%
                    </span>
                  </td>
                  <td className="py-4 px-6 hidden lg:table-cell text-sm" style={{ color: '#a1a1aa' }}>{d.zone}</td>
                  <td className="py-4 px-6">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={d.available
                        ? { background: 'rgba(16,185,129,0.15)', color: '#34d399' }
                        : { color: '#a1a1aa' }}>
                      {d.available ? 'Available' : 'Busy'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                      disabled={!d.available}
                      style={d.available
                        ? { background: '#6366f1', color: '#fff', cursor: 'pointer' }
                        : { background: '#27272a', color: '#a1a1aa', cursor: 'not-allowed' }}>
                      Hire · ${d.fee} USDC
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="px-6 py-3 text-xs border-t" style={{ borderColor: '#27272a', color: '#a1a1aa' }}>
          Showing {filtered.length} of {drivers.length} drivers · Paginated at 50 per page in production
        </div>
      </div>
    </div>
  );
}
