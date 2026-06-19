import Link from 'next/link';

// Sample data — in production read from on-chain and backend
const metrics = {
  totalSupply: '100,000,000,000',
  poolBalance: '97,423,100,000',
  totalStaked: '1,248,000,000',
  totalBurned: '12,400,000',
  currentBuybackRate: '42,000 DVX/week',
  tradingFeeRevenue: '$148,200 (cumulative)',
  revenueDistributorBalance: '$23,400',
  lastDistribution: '2026-05-28',
  nextDistribution: '2026-06-04',
};

const teamWallets = [
  { label: 'Treasury (20%)', address: '0x7a8b...3c4d', balance: '—' },
  { label: 'Operations', address: '0x5e6f...7g8h', balance: '—' },
  { label: 'Dev Fund', address: '0x9i0j...1k2l', balance: '—' },
];

export default function MetricsPage() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-16">
      <div className="mb-10">
        <div className="section-tag">Transparency</div>
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#fafafa' }}>Token Metrics</h1>
        <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>
          Real-time DVX supply, staking stats, buyback rate, and treasury transparency.
          All data verifiable on-chain via Basescan.
        </p>
      </div>

      {/* Main metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
        {[
          { label: 'Total Supply (Fixed)', value: metrics.totalSupply, sub: 'DVX · No mint function' },
          { label: 'In Uniswap V4 Pool', value: metrics.poolBalance, sub: 'DVX · Liquidity locked' },
          { label: 'Total Staked', value: metrics.totalStaked, sub: 'DVX · Earning revenue' },
          { label: 'Total Burned', value: metrics.totalBurned, sub: 'DVX · Permanently removed' },
          { label: 'Buyback Rate', value: metrics.currentBuybackRate, sub: 'From incentive pool' },
          { label: 'Trading Fee Revenue', value: metrics.tradingFeeRevenue, sub: 'WETH + DVX · All-time' },
        ].map((m) => (
          <div key={m.label} className="rounded-xl p-5 border"
            style={{ background: '#111113', borderColor: '#27272a' }}>
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>{m.label}</div>
            <div className="text-lg font-bold mb-1" style={{ color: '#22d3ee' }}>{m.value}</div>
            <div className="text-xs" style={{ color: '#a1a1aa' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue split visual */}
      <div className="rounded-xl p-6 border mb-12" style={{ background: '#111113', borderColor: '#27272a' }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: '#fafafa' }}>Revenue Allocation (Immutable)</h3>
        <div className="flex h-3 rounded-full overflow-hidden mb-3">
          <div style={{ width: '70%', background: '#6366f1' }} />
          <div style={{ width: '20%', background: '#22d3ee' }} />
          <div style={{ width: '10%', background: '#a78bfa' }} />
        </div>
        <div className="flex gap-6 text-xs" style={{ color: '#a1a1aa' }}>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#6366f1' }} />70% DVX Stakers</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#22d3ee' }} />20% Protocol Dev</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#a78bfa' }} />10% Driver Incentive</span>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 text-center">
          <div className="rounded-lg p-3" style={{ background: '#0f0f11' }}>
            <div className="font-semibold" style={{ color: '#fafafa' }}>{metrics.revenueDistributorBalance}</div>
            <div className="text-xs mt-1" style={{ color: '#a1a1aa' }}>Awaiting distribution</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: '#0f0f11' }}>
            <div className="font-semibold" style={{ color: '#fafafa' }}>{metrics.lastDistribution}</div>
            <div className="text-xs mt-1" style={{ color: '#a1a1aa' }}>Last distribution</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: '#0f0f11' }}>
            <div className="font-semibold" style={{ color: '#fafafa' }}>{metrics.nextDistribution}</div>
            <div className="text-xs mt-1" style={{ color: '#a1a1aa' }}>Next distribution</div>
          </div>
        </div>
      </div>

      {/* Team wallets */}
      <div className="rounded-xl p-6 border mb-12" style={{ background: '#111113', borderColor: '#27272a' }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: '#fafafa' }}>Team Wallets (Public)</h3>
        <p className="text-xs mb-4" style={{ color: '#a1a1aa' }}>
          All team wallets are published. Purchases tracked on-chain. Monthly treasury reports published.
        </p>
        {teamWallets.map((w) => (
          <div key={w.label} className="flex justify-between items-center py-3 border-b" style={{ borderColor: '#27272a' }}>
            <span className="text-sm" style={{ color: '#fafafa' }}>{w.label}</span>
            <code className="text-sm" style={{ color: '#22d3ee', fontFamily: '"Courier New", monospace' }}>{w.address}</code>
          </div>
        ))}
      </div>

      <div className="text-center">
        <Link href="/" className="btn-secondary">← Back to Home</Link>
      </div>
    </div>
  );
}
