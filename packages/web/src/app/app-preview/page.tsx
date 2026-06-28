'use client';
import { useState } from 'react';
import Link from 'next/link';

const screens = ['home', 'trip', 'score', 'wallet'] as const;
type Screen = typeof screens[number];

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: 320, height: 640 }}>
      {/* Phone body */}
      <div className="absolute inset-0 rounded-[40px] border-[3px]"
        style={{ borderColor: '#3f3f46', background: '#09090b', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 rounded-b-2xl" style={{ background: '#09090b', border: '2px solid #3f3f46', borderTop: 'none' }} />
        {/* Screen content */}
        <div className="absolute top-8 left-3 right-3 bottom-3 rounded-[30px] overflow-hidden" style={{ background: '#111113' }}>
          {children}
        </div>
        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full" style={{ background: '#3f3f46' }} />
      </div>
    </div>
  );
}

function HomeScreen() {
  return (
    <div className="h-full flex flex-col p-5 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs" style={{ color: '#a1a1aa' }}>Good morning</div>
          <div className="text-base font-semibold" style={{ color: '#fafafa' }}>Driver_2847</div>
        </div>
        <div className="w-8 h-8 rounded-full" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)' }} />
      </div>

      {/* Score card */}
      <div className="rounded-2xl p-5 mb-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(34,211,238,0.1))', border: '1px solid rgba(99,102,241,0.3)' }}>
        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: '#a1a1aa' }}>Safety Score</div>
        <div className="text-4xl font-bold mb-1" style={{ color: '#fafafa' }}>847</div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}>Grade B</span>
          <span className="text-xs" style={{ color: '#34d399' }}>↑ +12 this week</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Trips', value: '142' },
          { label: 'Distance', value: '2,847 km' },
          { label: 'DVX', value: '1,240' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: '#0f0f11' }}>
            <div className="text-sm font-bold" style={{ color: '#fafafa' }}>{s.value}</div>
            <div className="text-xs" style={{ color: '#a1a1aa' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent trips */}
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>Recent Trips</div>
      <div className="flex-1 space-y-2 overflow-hidden">
        {[
          { route: 'Home → Office', score: 912, grade: 'A', reward: '45.6 DVX', time: '32 min' },
          { route: 'Office → Gym', score: 834, grade: 'B', reward: '41.7 DVX', time: '18 min' },
          { route: 'Gym → Home', score: 789, grade: 'C', reward: '39.5 DVX', time: '25 min' },
        ].map((t, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#0f0f11' }}>
            <div>
              <div className="text-xs font-medium" style={{ color: '#fafafa' }}>{t.route}</div>
              <div className="text-xs" style={{ color: '#a1a1aa' }}>{t.time}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold" style={{ color: t.grade === 'A' ? '#34d399' : t.grade === 'B' ? '#22d3ee' : '#a78bfa' }}>{t.score}</div>
              <div className="text-xs" style={{ color: '#22d3ee' }}>{t.reward}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="flex justify-around pt-3 mt-auto border-t" style={{ borderColor: '#27272a' }}>
        {['Home', 'Trip', 'Score', 'Wallet'].map((tab) => (
          <div key={tab} className="text-xs text-center" style={{ color: tab === 'Home' ? '#6366f1' : '#a1a1aa' }}>{tab}</div>
        ))}
      </div>
    </div>
  );
}

function TripScreen() {
  return (
    <div className="h-full flex flex-col p-5 pt-8">
      <div className="text-base font-semibold mb-4" style={{ color: '#fafafa' }}>Trip Recording</div>

      {/* Active trip */}
      <div className="rounded-2xl p-5 mb-4 text-center"
        style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.2)' }}>
        <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
          style={{ background: 'rgba(34,211,238,0.1)', border: '2px solid #22d3ee' }}>
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />
        </div>
        <div className="text-sm font-medium mb-1" style={{ color: '#22d3ee' }}>Recording Trip...</div>
        <div className="text-2xl font-bold mb-1" style={{ color: '#fafafa' }}>12:34</div>
        <div className="text-xs" style={{ color: '#a1a1aa' }}>Duration</div>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: 'Speed', value: '47 km/h', status: 'good' },
          { label: 'Distance', value: '5.2 km', status: 'good' },
          { label: 'Phone', value: 'Not used', status: 'good' },
          { label: 'Braking', value: '0 harsh', status: 'good' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-3" style={{ background: '#0f0f11' }}>
            <div className="text-xs mb-1" style={{ color: '#a1a1aa' }}>{s.label}</div>
            <div className="text-sm font-medium" style={{ color: '#34d399' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="text-xs text-center mb-4" style={{ color: '#a1a1aa' }}>
        Auto-detected driving · GPS active · Phone sensors recording
      </div>

      <div className="mt-auto">
        <div className="w-full py-3 rounded-xl text-center text-sm font-medium"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          End Trip
        </div>
      </div>

      <div className="flex justify-around pt-3 mt-3 border-t" style={{ borderColor: '#27272a' }}>
        {['Home', 'Trip', 'Score', 'Wallet'].map((tab) => (
          <div key={tab} className="text-xs text-center" style={{ color: tab === 'Trip' ? '#6366f1' : '#a1a1aa' }}>{tab}</div>
        ))}
      </div>
    </div>
  );
}

function ScoreScreen() {
  return (
    <div className="h-full flex flex-col p-5 pt-8">
      <div className="text-base font-semibold mb-4" style={{ color: '#fafafa' }}>Score Breakdown</div>

      {/* Overall */}
      <div className="text-center mb-5">
        <div className="text-5xl font-bold" style={{ color: '#fafafa' }}>847</div>
        <div className="text-xs mt-1" style={{ color: '#a1a1aa' }}>Safety Score · Grade B · Verified</div>
      </div>

      {/* Factors */}
      <div className="space-y-3 flex-1">
        {[
          { label: 'Speed Compliance', score: 890, weight: '25%', color: '#6366f1' },
          { label: 'Braking Smoothness', score: 850, weight: '20%', color: '#22d3ee' },
          { label: 'Acceleration', score: 820, weight: '15%', color: '#a78bfa' },
          { label: 'Cornering Safety', score: 810, weight: '15%', color: '#34d399' },
          { label: 'Phone Avoidance', score: 920, weight: '15%', color: '#fb923c' },
          { label: 'Time of Day', score: 1000, weight: '10%', color: '#f87171' },
        ].map((f) => (
          <div key={f.label}>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: '#fafafa' }}>{f.label} <span style={{ color: '#a1a1aa' }}>({f.weight})</span></span>
              <span style={{ color: f.color }}>{f.score}</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: '#27272a' }}>
              <div className="h-full rounded-full" style={{ width: `${f.score / 10}%`, background: f.color }} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-around pt-3 mt-3 border-t" style={{ borderColor: '#27272a' }}>
        {['Home', 'Trip', 'Score', 'Wallet'].map((tab) => (
          <div key={tab} className="text-xs text-center" style={{ color: tab === 'Score' ? '#6366f1' : '#a1a1aa' }}>{tab}</div>
        ))}
      </div>
    </div>
  );
}

function WalletScreen() {
  return (
    <div className="h-full flex flex-col p-5 pt-8">
      <div className="text-base font-semibold mb-4" style={{ color: '#fafafa' }}>Wallet</div>

      {/* Balance */}
      <div className="rounded-2xl p-5 mb-4 text-center"
        style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.1), rgba(99,102,241,0.1))', border: '1px solid rgba(34,211,238,0.2)' }}>
        <div className="text-xs mb-1" style={{ color: '#a1a1aa' }}>SafeDrive Credits</div>
        <div className="text-3xl font-bold mb-1" style={{ color: '#fafafa' }}>1,240 DVX</div>
        <div className="text-xs" style={{ color: '#22d3ee' }}>≈ $124.00</div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Stake', icon: '📈' },
          { label: 'Claim', icon: '💰' },
          { label: 'Send', icon: '↗️' },
        ].map((a) => (
          <div key={a.label} className="rounded-xl p-3 text-center" style={{ background: '#0f0f11' }}>
            <div className="text-lg mb-1">{a.icon}</div>
            <div className="text-xs" style={{ color: '#a1a1aa' }}>{a.label}</div>
          </div>
        ))}
      </div>

      {/* Staking info */}
      <div className="rounded-xl p-4 mb-4" style={{ background: '#0f0f11' }}>
        <div className="flex justify-between mb-2">
          <span className="text-xs" style={{ color: '#a1a1aa' }}>Staked</span>
          <span className="text-xs font-medium" style={{ color: '#fafafa' }}>800 DVX</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-xs" style={{ color: '#a1a1aa' }}>Pending Revenue</span>
          <span className="text-xs font-medium" style={{ color: '#34d399' }}>2.4 USDC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs" style={{ color: '#a1a1aa' }}>Next Distribution</span>
          <span className="text-xs font-medium" style={{ color: '#fafafa' }}>3 days</span>
        </div>
      </div>

      {/* Recent activity */}
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#a1a1aa' }}>Activity</div>
      <div className="flex-1 space-y-2 overflow-hidden">
        {[
          { type: 'Earned', amount: '+45.6 DVX', desc: 'Trip reward', color: '#34d399' },
          { type: 'Staked', amount: '-100 DVX', desc: 'Auto-stake', color: '#a78bfa' },
          { type: 'Claimed', amount: '+1.2 USDC', desc: 'Revenue share', color: '#22d3ee' },
        ].map((tx, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg" style={{ background: '#0f0f11' }}>
            <div>
              <div className="text-xs font-medium" style={{ color: '#fafafa' }}>{tx.type}</div>
              <div className="text-xs" style={{ color: '#a1a1aa' }}>{tx.desc}</div>
            </div>
            <div className="text-xs font-bold" style={{ color: tx.color }}>{tx.amount}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-around pt-3 mt-3 border-t" style={{ borderColor: '#27272a' }}>
        {['Home', 'Trip', 'Score', 'Wallet'].map((tab) => (
          <div key={tab} className="text-xs text-center" style={{ color: tab === 'Wallet' ? '#6366f1' : '#a1a1aa' }}>{tab}</div>
        ))}
      </div>
    </div>
  );
}

export default function AppPreviewPage() {
  const [activeScreen, setActiveScreen] = useState<Screen>('home');

  return (
    <div className="min-h-screen relative">
      <div className="absolute top-20 left-10 w-80 h-80 rounded-full blur-3xl opacity-10"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />

      <div className="max-w-4xl mx-auto px-8 py-16 relative">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm mb-6"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a1a1aa' }}>
            App Preview
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3" style={{ color: '#fafafa' }}>
            DrivX Mobile App
          </h1>
          <p className="text-sm" style={{ color: '#a1a1aa' }}>
            No blockchain jargon. No seed phrases. Just drive safely and earn.
          </p>
        </div>

        {/* Screen tabs */}
        <div className="flex justify-center gap-2 mb-8">
          {screens.map((s) => (
            <button key={s} onClick={() => setActiveScreen(s)}
              className="px-4 py-2 rounded-lg text-sm capitalize transition-all"
              style={{
                background: activeScreen === s ? '#6366f1' : 'transparent',
                color: activeScreen === s ? '#fff' : '#a1a1aa',
                border: activeScreen === s ? 'none' : '1px solid #27272a',
              }}>
              {s}
            </button>
          ))}
        </div>

        {/* Phone */}
        <PhoneFrame>
          {activeScreen === 'home' && <HomeScreen />}
          {activeScreen === 'trip' && <TripScreen />}
          {activeScreen === 'score' && <ScoreScreen />}
          {activeScreen === 'wallet' && <WalletScreen />}
        </PhoneFrame>

        {/* Description */}
        <div className="mt-10 text-center max-w-md mx-auto">
          {activeScreen === 'home' && <p className="text-sm" style={{ color: '#a1a1aa' }}>Dashboard showing your Safety Score, recent trips, and DVX earnings at a glance.</p>}
          {activeScreen === 'trip' && <p className="text-sm" style={{ color: '#a1a1aa' }}>Auto-detected trip recording. Phone sensors capture speed, braking, cornering, and phone usage in real-time.</p>}
          {activeScreen === 'score' && <p className="text-sm" style={{ color: '#a1a1aa' }}>Detailed breakdown of your 6-factor Safety Score with progress bars for each driving behaviour.</p>}
          {activeScreen === 'wallet' && <p className="text-sm" style={{ color: '#a1a1aa' }}>Wallet showing DVX balance as "SafeDrive Credits". Stake, claim revenue, and view transaction history — no crypto complexity.</p>}
        </div>

        {/* Try it yourself CTA */}
        <div className="mt-8 text-center">
          <Link href="/demo"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all"
            style={{ background: '#6366f1', color: '#fff', boxShadow: '0 0 20px rgba(99,102,241,0.2)' }}>
            Try the Interactive Demo →
          </Link>
          <p className="text-xs mt-3" style={{ color: '#a1a1aa' }}>
            Walk through the full user journey — signup, consent, submit a trip, see your score, and earn DVX.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link href="/explore" className="text-sm transition-colors" style={{ color: '#a1a1aa' }}>← Back to Explore</Link>
        </div>
      </div>
    </div>
  );
}
