'use client';
import Link from 'next/link';
import { useState } from 'react';

const pages = [
  { href: '/demo', title: 'Trip Score Simulator', desc: 'Interact with the scoring algorithm live. Adjust 6 driving factors and see your score, grade, and DVX reward in real-time.', icon: '⚡', color: '#22d3ee' },
  { href: '/leaderboard', title: 'Safety Leaderboard', desc: 'Top drivers by Safety Score globally. Anonymised by default. Regional filters.', icon: '01', color: '#6366f1' },
  { href: '/dashboard', title: 'Driver Marketplace', desc: 'Find and hire verified safe drivers. Filter by score, zone, category. Smart contract escrow.', icon: '02', color: '#22d3ee' },
  { href: '/accountability', title: 'Platform Accountability', desc: 'Immutable on-chain reports exposing unsafe platform speed targets. k-anonymity enforced.', icon: '03', color: '#f87171' },
  { href: '/community', title: 'Community & Roadmap', desc: 'Network growth, safety improvements, and the 5-phase protocol roadmap.', icon: '04', color: '#34d399' },
  { href: '/metrics', title: 'Token Metrics', desc: 'Real-time DVX supply, staking stats, buyback rate, revenue distribution, team wallets.', icon: '05', color: '#a78bfa' },
];

function Card({ page }: { page: typeof pages[0] }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={page.href}
      className="block rounded-2xl p-8 border relative overflow-hidden transition-all duration-300"
      style={{
        background: hovered ? '#18181b' : '#111113',
        borderColor: hovered ? page.color : '#27272a',
        boxShadow: hovered ? `0 0 40px ${page.color}20` : 'none',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      {/* Glow orb */}
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20 blur-3xl transition-opacity duration-300"
        style={{ background: page.color, opacity: hovered ? 0.3 : 0.05 }} />

      <div className="relative">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold mb-4"
          style={{ background: `${page.color}15`, color: page.color, border: `1px solid ${page.color}30` }}>
          {page.icon}
        </div>
        <h3 className="text-lg font-semibold mb-2" style={{ color: '#fafafa' }}>{page.title}</h3>
        <p className="text-sm leading-relaxed mb-4" style={{ color: '#a1a1aa' }}>{page.desc}</p>
        <div className="flex items-center gap-1 text-sm font-medium transition-all duration-300"
          style={{ color: page.color, transform: hovered ? 'translateX(4px)' : 'none' }}>
          Explore →
        </div>
      </div>
    </Link>
  );
}

export default function ExplorePage() {
  return (
    <div className="min-h-screen relative">
      {/* Floating orbs background */}
      <div className="absolute top-20 left-10 w-96 h-96 rounded-full blur-3xl opacity-10"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
      <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full blur-3xl opacity-10"
        style={{ background: 'radial-gradient(circle, #22d3ee, transparent)' }} />

      <div className="max-w-5xl mx-auto px-8 py-20 relative">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm mb-6"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a1a1aa' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />
            Live Demo — Sample Data
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4"
            style={{
              background: 'linear-gradient(135deg, #fafafa 0%, #6366f1 50%, #22d3ee 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
            Explore the Protocol
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#a1a1aa' }}>
            Preview DrivX platform features. All pages are functional demos showing how the protocol works in production.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {pages.map((p) => (
            <Card key={p.href} page={p} />
          ))}
        </div>

        {/* Testnet Contracts */}
        <div id="contracts" className="mb-16 rounded-2xl p-8 relative overflow-hidden"
          style={{ background: '#111113', border: '1px solid #27272a' }}>
          <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full blur-3xl opacity-10"
            style={{ background: '#22d3ee' }} />
          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#34d399' }} />
              <h2 className="text-xl font-bold" style={{ color: '#fafafa' }}>Live on Base Sepolia Testnet</h2>
            </div>
            <p className="text-sm mb-6" style={{ color: '#a1a1aa' }}>
              All contracts deployed and verified. Click any address to view on Basescan.
            </p>
            <div className="grid gap-2">
              {[
                { name: 'SafetyRegistry', address: '0x0A1E6C8B6EcF597a12031C55a626dfBcC5877Dce', desc: 'On-chain driving identity' },
                { name: 'ConsentManager', address: '0x1951eeCAf6B1410EE5ee0b336460EfFd0e3D1B65', desc: 'Driver data consent' },
                { name: 'StakingContract', address: '0x3756B083a037458a93f1E2F9D9B5D794d2E8DFbE', desc: '100 DVX min, 7-day cooldown' },
                { name: 'RevenueDistributor', address: '0x7B09A6211504AEE2304257be350E110eCE9F8B33', desc: 'Immutable 70/20/10 split' },
                { name: 'DVXBuyback', address: '0x5Fc45Dfb22497A494344F3E252212a0b0AfD7e95', desc: 'Weekly TWAP buyback' },
                { name: 'GovernanceTimelock', address: '0x77b19916730D89Af0B71337E086De729AFeB47D7', desc: '48-hour delay' },
                { name: 'MarketplaceContract', address: '0x1fda60DD1A3C41224d43DEC60b3b0B5BC2351b69', desc: 'Delivery escrow' },
              ].map((c) => (
                <a key={c.name}
                  href={`https://sepolia.basescan.org/address/${c.address}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg transition-all duration-200"
                  style={{ background: '#0f0f11', border: '1px solid transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#18181b'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#0f0f11'; }}>
                  <div>
                    <span className="text-sm font-medium" style={{ color: '#fafafa' }}>{c.name}</span>
                    <span className="text-xs ml-2" style={{ color: '#a1a1aa' }}>— {c.desc}</span>
                  </div>
                  <code className="text-xs hidden sm:block" style={{ color: '#22d3ee', fontFamily: '"Courier New", monospace' }}>
                    {c.address.slice(0, 6)}...{c.address.slice(-4)}
                  </code>
                </a>
              ))}
            </div>
            <div className="mt-4 text-xs" style={{ color: '#a1a1aa' }}>
              Network: Base Sepolia (Chain ID: 84532) · All contracts immutable · No proxy/upgradeability
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center rounded-2xl p-10 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(34,211,238,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#fafafa' }}>Want early access?</h2>
          <p className="text-sm mb-6" style={{ color: '#a1a1aa' }}>
            First 10,000 drivers with 20+ verified trips get 500 DVX early contributor bonus.
          </p>
          <div className="flex gap-4 justify-center">
            <a href="https://x.com/drivx_" target="_blank" rel="noopener noreferrer"
              className="btn-primary px-6 py-3">Follow for Launch Updates</a>
            <a href="https://github.com/jpdeveloper89-cmd/drivx" target="_blank" rel="noopener noreferrer"
              className="btn-secondary px-6 py-3">View Source Code</a>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href="/" className="text-sm transition-colors" style={{ color: '#a1a1aa' }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
