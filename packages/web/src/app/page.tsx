import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="min-h-screen flex flex-col justify-center items-center text-center px-8 py-32">
        <div className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: '#a1a1aa' }}>
          Driver-Owned Protocol on Base
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight max-w-4xl mb-6"
          style={{
            background: 'linear-gradient(135deg, #fafafa 0%, #6366f1 50%, #22d3ee 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
          Your driving data is worth billions. Own it.
        </h1>
        <p className="text-lg max-w-xl leading-relaxed mb-10" style={{ color: '#a1a1aa' }}>
          DrivX turns safe driving into a verifiable on-chain identity. Earn real revenue — not printed tokens — from the value you create.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/dashboard" className="btn-primary px-8 py-3.5 text-base">Get Started</Link>
          <a href="#how" className="btn-secondary px-8 py-3.5 text-base">How It Works</a>
        </div>
        <div className="mt-16 h-0.5 w-72 rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, #6366f1, #22d3ee, transparent)', animation: 'pulse-glow 3s ease-in-out infinite' }} />
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="border-y border-border">
        <div className="max-w-5xl mx-auto px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '$950B', label: 'Insurance Market' },
            { value: '435M', label: 'Gig Workers Globally' },
            { value: '100B', label: 'Fixed DVX Supply' },
            { value: '70%', label: 'Revenue to Drivers' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold tracking-tight" style={{ color: '#22d3ee' }}>{s.value}</div>
              <div className="text-xs uppercase tracking-widest mt-1" style={{ color: '#a1a1aa' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Token address */}
      <div className="text-center py-5 border-b border-border text-sm" style={{ color: '#a1a1aa' }}>
        <span className="text-xs uppercase tracking-widest mr-3">$DVX Contract</span>
        <code className="px-4 py-1.5 rounded text-sm" style={{ background: '#111113', border: '1px solid #27272a', color: '#22d3ee' }}>
          TBA — Launching Soon
        </code>
      </div>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section id="how" className="max-w-6xl mx-auto px-8 py-24">
        <div className="section-tag">How It Works</div>
        <h2 className="section-title">Drive. Score. Earn.</h2>
        <p className="section-desc">No hardware. No seed phrases. No crypto knowledge needed. Just drive safely and let the protocol handle the rest.</p>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { n: '01', title: 'Drive', desc: 'The app auto-detects your driving using phone sensors. No manual start, no dongles. Just drive normally.' },
            { n: '02', title: 'Build Your Score', desc: 'Every trip builds your on-chain Safety Score (0–1000). Speed, braking, cornering, phone usage — all measured, all verified.' },
            { n: '03', title: 'Own Your Identity', desc: 'Your Driving Identity lives on-chain. Portable across insurers, employers, and platforms. You control who sees it.' },
            { n: '04', title: 'Earn Revenue', desc: 'Stake DVX and earn weekly distributions in WETH + USDC from real protocol revenue. Not emissions. Not inflation.' },
          ].map((c) => (
            <div key={c.n} className="card-dark">
              <div className="text-xs font-semibold mb-3" style={{ color: '#6366f1' }}>{c.n}</div>
              <h3 className="text-base font-semibold mb-2" style={{ color: '#fafafa' }}>{c.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why DrivX ────────────────────────────────────────────────────── */}
      <section style={{ background: '#0f0f11' }} className="py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="section-tag">Why DrivX</div>
          <h2 className="section-title">Not another drive-to-earn token.</h2>
          <p className="section-desc">Most crypto driving projects print tokens as rewards. When emissions slow, the token dies. DrivX is structurally different.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Real Revenue, Not Emissions', desc: 'Stakers earn WETH + USDC from trading fees, insurance verification fees, and marketplace fees. No new tokens are ever minted.' },
              { title: 'Fixed Supply, Deflationary', desc: '100B DVX. No mint function. Buyback-and-burn reduces supply permanently. Every burn is on-chain and irreversible.' },
              { title: 'No Team Tokens', desc: 'Zero pre-allocation. 100% of supply into the liquidity pool. Team funded from 20% treasury. All wallets published at launch.' },
              { title: 'On-Chain Identity', desc: 'Your Safety Score is portable, verifiable, and composable. No platform can revoke it. No company can lock it. You own it.' },
              { title: 'Score-Weighted Yield', desc: 'Revenue share = stake × Safety Score. A safe driver with 1K DVX earns more than a speculator with 10K DVX and no score.' },
              { title: 'Immutable Economics', desc: 'The 70/20/10 revenue split is hardcoded. No admin keys. No governance can change it. Verified on Basescan.' },
            ].map((c) => (
              <div key={c.title} className="card-dark">
                <h3 className="text-base font-semibold mb-2" style={{ color: '#fafafa' }}>{c.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tokenomics ───────────────────────────────────────────────────── */}
      <section id="tokenomics" className="max-w-6xl mx-auto px-8 py-24">
        <div className="section-tag">Tokenomics</div>
        <h2 className="section-title">Transparent. Fixed. Deflationary.</h2>
        <p className="section-desc">100% fair launch via Bankr Bot on Base. No pre-sale. No VCs. No vesting. Instant liquidity from block 1.</p>
        <div className="grid md:grid-cols-2 gap-16 items-start">
          {/* Token info list */}
          <div>
            {[
              { k: 'Token', v: '$DVX' },
              { k: 'Network', v: 'Base (Ethereum L2)' },
              { k: 'Total Supply', v: '100,000,000,000' },
              { k: 'Minting', v: 'Impossible (no function)' },
              { k: 'Launch', v: '100% into Uniswap V4 LP' },
              { k: 'Liquidity', v: 'Locked permanently' },
              { k: 'Swap Fee', v: '1.2% per trade' },
              { k: 'Protocol Share', v: '57% of swap fee' },
            ].map((item) => (
              <div key={item.k} className="flex justify-between items-center py-4 border-b border-border">
                <span className="text-sm" style={{ color: '#a1a1aa' }}>{item.k}</span>
                <span className="text-sm font-semibold" style={{ color: '#fafafa' }}>{item.v}</span>
              </div>
            ))}
          </div>
          {/* Revenue split */}
          <div>
            <h3 className="text-base font-semibold mb-1" style={{ color: '#fafafa' }}>Revenue Allocation</h3>
            <p className="text-sm mb-4" style={{ color: '#a1a1aa' }}>Hardcoded. Immutable. No admin override.</p>
            <div className="flex h-2 rounded-full overflow-hidden mb-3">
              <div className="flex-none" style={{ width: '70%', background: '#6366f1' }} />
              <div className="flex-none" style={{ width: '20%', background: '#22d3ee' }} />
              <div className="flex-none" style={{ width: '10%', background: '#a78bfa' }} />
            </div>
            <div className="flex gap-6 text-xs" style={{ color: '#a1a1aa' }}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#6366f1' }} />70% Safe Drivers</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#22d3ee' }} />20% Protocol Dev</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#a78bfa' }} />10% Incentive Pool</span>
            </div>
            <div className="mt-8 p-6 rounded-xl" style={{ background: '#0f0f11' }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: '#fafafa' }}>Staking Formula</h3>
              <code className="text-sm block mb-3" style={{ color: '#a1a1aa', fontFamily: '"Courier New", monospace' }}>
                your_share = (your_stake × your_score) / Σ(all_stakes × all_scores)
              </code>
              <p className="text-xs" style={{ color: '#a1a1aa' }}>
                Min stake: 100 DVX · 7-day cooldown · Revenue in WETH + USDC + DVX
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Roadmap ──────────────────────────────────────────────────────── */}
      <section id="roadmap" style={{ background: '#0f0f11' }} className="py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="section-tag">Roadmap</div>
          <h2 className="section-title">From app to trustless infrastructure.</h2>
          <p className="section-desc">Each phase builds on the last. Revenue from day one. Trustless scoring by year two.</p>
          <div className="relative pl-8 border-l border-border space-y-10">
            {[
              { phase: 'Phase 1 — Q3 2026', title: 'Foundation', desc: 'Mobile app live (iOS + Android). Auto-detection, scoring, trip history. Build driver base. No crypto visible.' },
              { phase: 'Phase 2 — Q4 2026', title: 'Token Launch', desc: 'DVX deployed via Bankr Bot on Base. Revenue Distributor, Staking, Buyback contracts live. Trip rewards enabled. Early contributor bonus active.' },
              { phase: 'Phase 3 — Q1 2027', title: 'Insurance Integration', desc: 'Verification API live. First insurer partnerships. Drivers unlock premium discounts from their Safety Score. Consent management active.' },
              { phase: 'Phase 4 — Q2 2027', title: 'Marketplace & Scale', desc: 'Direct-hire delivery marketplace. Accountability Engine and public dashboard. Infrastructure APIs. Government data licensing.' },
              { phase: 'Phase 5 — Q3 2027+', title: 'Trustless Infrastructure', desc: 'ZK score proofs. Verifiable computation via zkVM. On-device federated scoring. Sybil-resistant driving proofs.' },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-10 top-1.5 w-3 h-3 rounded-full border-2" style={{ borderColor: '#6366f1', background: '#09090b' }} />
                <div className="text-xs uppercase tracking-widest mb-1" style={{ color: '#a1a1aa' }}>{item.phase}</div>
                <div className="text-base font-semibold mb-1" style={{ color: '#fafafa' }}>{item.title}</div>
                <div className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-border text-center py-24 px-8">
        <h2 className="text-4xl font-bold tracking-tight mb-4" style={{ color: '#fafafa' }}>
          Safe drivers keep roads safe.<br />DrivX makes sure they get paid.
        </h2>
        <p className="text-lg mb-8" style={{ color: '#a1a1aa' }}>Join the protocol. Own your data. Earn from the value you create.</p>
        <div className="flex gap-4 justify-center">
          <Link href="/dashboard" className="btn-primary px-8 py-3.5 text-base">Launch App</Link>
          <Link href="/leaderboard" className="btn-secondary px-8 py-3.5 text-base">View Leaderboard</Link>
        </div>
      </section>
    </div>
  );
}
