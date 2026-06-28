'use client';
import { useState } from 'react';
import Link from 'next/link';

const gradeColors: Record<string, string> = {
  A: '#34d399', B: '#22d3ee', C: '#a78bfa', D: '#fb923c', F: '#f87171',
};

const leaderboard = [
  { rank: 1, name: 'Driver_Mumbai', score: 982, reward: 49.1 },
  { rank: 2, name: 'SafeCommuter_SP', score: 971, reward: 48.6 },
  { rank: 3, name: 'NightOwl_CHI', score: 961, reward: 48.1 },
];

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: 280, height: 560 }}>
      <div className="absolute inset-0 rounded-[36px] border-[3px]"
        style={{ borderColor: '#3f3f46', background: '#09090b', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 rounded-b-xl" style={{ background: '#09090b', border: '2px solid #3f3f46', borderTop: 'none' }} />
        <div className="absolute top-7 left-2.5 right-2.5 bottom-2.5 rounded-[28px] overflow-hidden" style={{ background: '#111113' }}>
          {children}
        </div>
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-20 h-1 rounded-full" style={{ background: '#3f3f46' }} />
      </div>
    </div>
  );
}

function PhoneScreen({ step, data }: { step: number; data: any }) {
  if (step === 0) return (
    <div className="h-full p-4 pt-8 flex flex-col items-center justify-center text-center">
      <div className="text-3xl mb-3">📱</div>
      <div className="text-sm font-semibold mb-1" style={{ color: '#fafafa' }}>Welcome to DrivX</div>
      <div className="text-xs" style={{ color: '#a1a1aa' }}>Create account with email only</div>
      <div className="mt-4 w-full px-4">
        <div className="h-8 rounded-lg mb-2" style={{ background: '#0f0f11', border: '1px solid #27272a' }} />
        <div className="h-8 rounded-lg" style={{ background: '#6366f1' }} />
      </div>
    </div>
  );
  if (step === 1) return (
    <div className="h-full p-4 pt-8 flex flex-col items-center justify-center text-center">
      <div className="text-3xl mb-3">🔒</div>
      <div className="text-sm font-semibold mb-1" style={{ color: '#fafafa' }}>Data Consent</div>
      <div className="text-xs mb-3" style={{ color: '#a1a1aa' }}>You control your data</div>
      <div className="w-full space-y-1.5 px-2">
        {['GPS coordinates', 'Speed patterns', 'Phone usage', 'Trip duration'].map((d) => (
          <div key={d} className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: '#0f0f11', color: '#a1a1aa' }}>
            <span style={{ color: '#22d3ee' }}>✓</span>{d}
          </div>
        ))}
      </div>
    </div>
  );
  if (step === 2) return (
    <div className="h-full p-4 pt-8 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 rounded-full mb-3 flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.1)', border: '2px solid #22d3ee' }}>
        <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />
      </div>
      <div className="text-sm font-semibold mb-1" style={{ color: '#22d3ee' }}>Recording Trip</div>
      <div className="text-2xl font-bold mb-1" style={{ color: '#fafafa' }}>12:34</div>
      <div className="text-xs mb-3" style={{ color: '#a1a1aa' }}>{data.tripFrom || 'Home'} → {data.tripTo || 'Office'}</div>
      <div className="grid grid-cols-2 gap-2 w-full px-2">
        <div className="rounded-lg p-2" style={{ background: '#0f0f11' }}>
          <div className="text-xs" style={{ color: '#34d399' }}>47 km/h</div>
          <div className="text-xs" style={{ color: '#a1a1aa' }}>Speed</div>
        </div>
        <div className="rounded-lg p-2" style={{ background: '#0f0f11' }}>
          <div className="text-xs" style={{ color: '#34d399' }}>5.2 km</div>
          <div className="text-xs" style={{ color: '#a1a1aa' }}>Distance</div>
        </div>
      </div>
    </div>
  );

  if (step === 3) return (
    <div className="h-full p-4 pt-8 overflow-y-auto">
      <div className="text-center mb-3">
        <div className="text-3xl font-bold" style={{ color: '#fafafa' }}>{data.yourScore}</div>
        <div className="text-xs" style={{ color: '#a1a1aa' }}>Safety Score</div>
        <div className="text-sm font-bold mt-1" style={{ color: gradeColors[data.yourGrade] }}>Grade {data.yourGrade}</div>
      </div>
      <div className="space-y-1.5">
        {[
          { label: 'Speed', val: data.speedScore, color: '#6366f1' },
          { label: 'Braking', val: data.brakingScore, color: '#22d3ee' },
          { label: 'Phone', val: data.phoneScore, color: '#fb923c' },
          { label: 'Cornering', val: data.cornerScore, color: '#34d399' },
        ].map((f) => (
          <div key={f.label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span style={{ color: '#a1a1aa' }}>{f.label}</span>
              <span style={{ color: f.color }}>{f.val}</span>
            </div>
            <div className="h-1 rounded-full" style={{ background: '#27272a' }}>
              <div className="h-full rounded-full" style={{ width: `${f.val / 10}%`, background: f.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  if (step === 4) return (
    <div className="h-full p-4 pt-8">
      <div className="text-sm font-semibold mb-3 text-center" style={{ color: '#fafafa' }}>Leaderboard</div>
      <div className="space-y-1.5">
        {leaderboard.map((d) => (
          <div key={d.rank} className="flex items-center justify-between p-2 rounded-lg" style={{ background: '#0f0f11' }}>
            <span className="text-xs" style={{ color: '#6366f1' }}>#{d.rank} {d.name}</span>
            <span className="text-xs font-bold" style={{ color: '#22d3ee' }}>{d.score}</span>
          </div>
        ))}
        <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
          <span className="text-xs font-bold" style={{ color: '#fb923c' }}>You</span>
          <span className="text-xs font-bold" style={{ color: gradeColors[data.yourGrade] }}>{data.yourScore}</span>
        </div>
      </div>
    </div>
  );
  if (step === 5) return (
    <div className="h-full p-4 pt-8 flex flex-col items-center justify-center text-center">
      <div className="text-3xl mb-3">💰</div>
      <div className="text-xs mb-1" style={{ color: '#a1a1aa' }}>SafeDrive Credits</div>
      <div className="text-2xl font-bold mb-1" style={{ color: '#fafafa' }}>{data.yourReward} DVX</div>
      <div className="text-xs mb-4" style={{ color: '#22d3ee' }}>Earned this trip</div>
      <div className="grid grid-cols-2 gap-2 w-full px-2">
        <div className="rounded-lg p-2 text-center" style={{ background: '#0f0f11' }}>
          <div className="text-sm font-bold" style={{ color: '#a78bfa' }}>{(data.yourReward * 100).toFixed(0)}</div>
          <div className="text-xs" style={{ color: '#a1a1aa' }}>DVX/100 trips</div>
        </div>
        <div className="rounded-lg p-2 text-center" style={{ background: '#0f0f11' }}>
          <div className="text-sm font-bold" style={{ color: '#34d399' }}>70%</div>
          <div className="text-xs" style={{ color: '#a1a1aa' }}>Revenue share</div>
        </div>
      </div>
    </div>
  );
  return null;
}

export default function DemoPage() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [consented, setConsented] = useState(false);
  const [tripFrom, setTripFrom] = useState('');
  const [tripTo, setTripTo] = useState('');
  const [overspeeding, setOverspeeding] = useState(2);
  const [harshBraking, setHarshBraking] = useState(1);
  const [phoneMinutes, setPhoneMinutes] = useState(1);
  const [unsafeTurns, setUnsafeTurns] = useState(0);

  const speedScore = Math.round(1000 * (1 - Math.min(overspeeding / 5, 1)));
  const brakingScore = Math.round(1000 * (1 - Math.min(harshBraking / 4, 1)));
  const phoneScore = Math.round(1000 * (1 - Math.min(phoneMinutes / 3, 1)));
  const cornerScore = Math.round(1000 * (1 - Math.min(unsafeTurns / 3, 1)));
  const accelScore = 900;
  const timeScore = 1000;
  const yourScore = Math.round(speedScore * 0.25 + brakingScore * 0.20 + accelScore * 0.15 + cornerScore * 0.15 + phoneScore * 0.15 + timeScore * 0.10);
  const idealScore = 970;
  const yourGrade = yourScore >= 900 ? 'A' : yourScore >= 800 ? 'B' : yourScore >= 700 ? 'C' : yourScore >= 600 ? 'D' : 'F';
  const yourReward = Math.round((yourScore / 1000) * 50 * 100) / 100;
  const idealReward = 48.5;

  const steps = ['Sign Up', 'Consent', 'Drive', 'Score', 'Leaderboard', 'Earn'];
  const phoneData = { yourScore, yourGrade, yourReward, speedScore, brakingScore, phoneScore, cornerScore, tripFrom, tripTo };

  return (
    <div className="min-h-screen relative">
      <div className="max-w-6xl mx-auto px-8 py-16 relative">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#fafafa' }}>Experience DrivX</h1>
          <p className="text-sm" style={{ color: '#a1a1aa' }}>Walk through the full user journey — from signup to earning DVX.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: i <= step ? '#6366f1' : '#27272a', color: i <= step ? '#fff' : '#a1a1aa', boxShadow: i === step ? '0 0 10px rgba(99,102,241,0.4)' : 'none' }}>
                {i + 1}
              </div>
              <span className="text-xs hidden md:inline" style={{ color: i <= step ? '#fafafa' : '#a1a1aa' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Side by side: Phone + Controls */}
        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Left: Phone mockup */}
          <div className="flex justify-center">
            <PhoneFrame>
              <PhoneScreen step={step} data={phoneData} />
            </PhoneFrame>
          </div>

          {/* Right: Interactive controls */}
          <div className="rounded-2xl p-6 border min-h-[400px] flex flex-col"
            style={{ background: '#111113', borderColor: '#27272a' }}>

            {step === 0 && (
              <div className="flex-1 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs mb-4 self-start"
                  style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)', color: '#fb923c' }}>
                  Demo Only — No real account created
                </div>
                <h2 className="text-lg font-bold mb-2" style={{ color: '#fafafa' }}>Create your account</h2>
                <p className="text-sm mb-4" style={{ color: '#a1a1aa' }}>Just email — no wallet, no seed phrase needed.</p>
                <input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none mb-4"
                  style={{ background: '#0f0f11', border: '1px solid #27272a', color: '#fafafa' }} />
                <button onClick={() => email.includes('@') && setStep(1)}
                  className="w-full py-3 rounded-lg text-sm font-medium"
                  style={{ background: email.includes('@') ? '#6366f1' : '#27272a', color: email.includes('@') ? '#fff' : '#a1a1aa' }}>
                  Sign Up
                </button>
              </div>
            )}

            {step === 1 && (
              <div className="flex-1 flex flex-col justify-center">
                <h2 className="text-lg font-bold mb-2" style={{ color: '#fafafa' }}>Your data, your rules</h2>
                <p className="text-sm mb-4" style={{ color: '#a1a1aa' }}>DrivX records driving data. You choose who sees your score. Revoke anytime.</p>
                <label className="flex items-center gap-2 mb-4 cursor-pointer">
                  <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} style={{ accentColor: '#6366f1' }} />
                  <span className="text-sm" style={{ color: '#fafafa' }}>I consent to data collection for scoring</span>
                </label>
                <button onClick={() => consented && setStep(2)}
                  className="w-full py-3 rounded-lg text-sm font-medium"
                  style={{ background: consented ? '#6366f1' : '#27272a', color: consented ? '#fff' : '#a1a1aa' }}>
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="flex-1 flex flex-col justify-center">
                <h2 className="text-lg font-bold mb-2" style={{ color: '#fafafa' }}>Submit your trip</h2>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#a1a1aa' }}>From</label>
                    <input type="text" placeholder="Home" value={tripFrom} onChange={(e) => setTripFrom(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: '#0f0f11', border: '1px solid #27272a', color: '#fafafa' }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#a1a1aa' }}>To</label>
                    <input type="text" placeholder="Office" value={tripTo} onChange={(e) => setTripTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: '#0f0f11', border: '1px solid #27272a', color: '#fafafa' }} />
                  </div>
                </div>
                <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6366f1' }}>Driving behaviour</div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div><label className="block text-xs mb-1" style={{ color: '#a1a1aa' }}>Overspeeding</label>
                    <input type="number" min={0} max={10} value={overspeeding} onChange={(e) => setOverspeeding(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg text-sm text-center outline-none" style={{ background: '#0f0f11', border: '1px solid #27272a', color: '#fafafa' }} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: '#a1a1aa' }}>Harsh brakes</label>
                    <input type="number" min={0} max={10} value={harshBraking} onChange={(e) => setHarshBraking(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg text-sm text-center outline-none" style={{ background: '#0f0f11', border: '1px solid #27272a', color: '#fafafa' }} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: '#a1a1aa' }}>Phone (min)</label>
                    <input type="number" min={0} max={10} value={phoneMinutes} onChange={(e) => setPhoneMinutes(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg text-sm text-center outline-none" style={{ background: '#0f0f11', border: '1px solid #27272a', color: '#fafafa' }} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: '#a1a1aa' }}>Unsafe turns</label>
                    <input type="number" min={0} max={10} value={unsafeTurns} onChange={(e) => setUnsafeTurns(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg text-sm text-center outline-none" style={{ background: '#0f0f11', border: '1px solid #27272a', color: '#fafafa' }} /></div>
                </div>
                <button onClick={() => setStep(3)} disabled={!tripFrom.trim() || !tripTo.trim()}
                  className="w-full py-3 rounded-lg text-sm font-medium"
                  style={{ background: tripFrom && tripTo ? '#6366f1' : '#27272a', color: tripFrom && tripTo ? '#fff' : '#a1a1aa' }}>
                  Submit Trip →
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="flex-1 overflow-y-auto">
                <h2 className="text-lg font-bold mb-1" style={{ color: '#fafafa' }}>Your Trip Score</h2>
                <p className="text-xs mb-4" style={{ color: '#a1a1aa' }}>{tripFrom} → {tripTo}</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="rounded-xl p-3 text-center" style={{ background: '#0f0f11', border: '1px solid rgba(99,102,241,0.3)' }}>
                    <div className="text-2xl font-bold" style={{ color: '#fafafa' }}>{yourScore}</div>
                    <div className="text-xs" style={{ color: gradeColors[yourGrade] }}>Grade {yourGrade} · {yourReward} DVX</div>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: '#0f0f11', border: '1px solid rgba(34,211,238,0.3)' }}>
                    <div className="text-2xl font-bold" style={{ color: '#fafafa' }}>{idealScore}</div>
                    <div className="text-xs" style={{ color: '#34d399' }}>Grade A · {idealReward} DVX</div>
                  </div>
                </div>
                <div className="rounded-xl p-3 mb-3 text-center text-xs" style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)', color: '#a1a1aa' }}>
                  You missed <span style={{ color: '#22d3ee', fontWeight: 600 }}>{(idealReward - yourReward).toFixed(1)} DVX</span> · Over 100 trips: <span style={{ color: '#22d3ee', fontWeight: 600 }}>{((idealReward - yourReward) * 100).toFixed(0)} DVX</span>
                </div>
                <div className="space-y-2 mb-3">
                  {[
                    { label: 'Speed', val: speedScore, color: '#6366f1' },
                    { label: 'Braking', val: brakingScore, color: '#22d3ee' },
                    { label: 'Acceleration', val: accelScore, color: '#a78bfa' },
                    { label: 'Cornering', val: cornerScore, color: '#34d399' },
                    { label: 'Phone', val: phoneScore, color: '#fb923c' },
                    { label: 'Time', val: timeScore, color: '#f87171' },
                  ].map((f) => (
                    <div key={f.label}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span style={{ color: '#a1a1aa' }}>{f.label}</span>
                        <span style={{ color: f.val >= 800 ? '#34d399' : f.val >= 600 ? '#fb923c' : '#f87171' }}>{f.val}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: '#27272a' }}>
                        <div className="h-full rounded-full" style={{ width: `${f.val / 10}%`, background: f.color }} />
                      </div>
                    </div>
                  ))}
                </div>
                {(overspeeding > 0 || harshBraking > 0 || phoneMinutes > 0 || unsafeTurns > 0) && (
                  <div className="rounded-xl p-3 mb-3" style={{ background: '#0f0f11' }}>
                    <div className="text-xs font-medium mb-1" style={{ color: '#fb923c' }}>Penalties:</div>
                    {overspeeding > 0 && <div className="text-xs flex justify-between" style={{ color: '#a1a1aa' }}><span>Overspeeding {overspeeding}x</span><span style={{ color: '#f87171' }}>-{1000 - speedScore}</span></div>}
                    {harshBraking > 0 && <div className="text-xs flex justify-between" style={{ color: '#a1a1aa' }}><span>Harsh braking {harshBraking}x</span><span style={{ color: '#f87171' }}>-{1000 - brakingScore}</span></div>}
                    {phoneMinutes > 0 && <div className="text-xs flex justify-between" style={{ color: '#a1a1aa' }}><span>Phone {phoneMinutes} min</span><span style={{ color: '#f87171' }}>-{1000 - phoneScore}</span></div>}
                    {unsafeTurns > 0 && <div className="text-xs flex justify-between" style={{ color: '#a1a1aa' }}><span>Unsafe turns {unsafeTurns}x</span><span style={{ color: '#f87171' }}>-{1000 - cornerScore}</span></div>}
                  </div>
                )}
                <button onClick={() => setStep(4)} className="w-full py-2.5 rounded-lg text-sm font-medium" style={{ background: '#6366f1', color: '#fff' }}>See Leaderboard →</button>
              </div>
            )}

            {step === 4 && (
              <div className="flex-1 flex flex-col justify-center">
                <h2 className="text-lg font-bold mb-4" style={{ color: '#fafafa' }}>Where you rank</h2>
                <div className="space-y-2 mb-4">
                  {leaderboard.map((d) => (
                    <div key={d.rank} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#0f0f11' }}>
                      <span className="text-sm" style={{ color: '#6366f1' }}>#{d.rank} {d.name}</span>
                      <span className="text-sm font-bold" style={{ color: '#22d3ee' }}>{d.score}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
                    <span className="text-sm font-bold" style={{ color: '#fb923c' }}>You</span>
                    <span className="text-sm font-bold" style={{ color: gradeColors[yourGrade] }}>{yourScore}</span>
                  </div>
                </div>
                <p className="text-xs text-center mb-4" style={{ color: '#a1a1aa' }}>Drive safer to climb the leaderboard</p>
                <button onClick={() => setStep(5)} className="w-full py-3 rounded-lg text-sm font-medium" style={{ background: '#6366f1', color: '#fff' }}>See Earnings →</button>
              </div>
            )}

            {step === 5 && (
              <div className="flex-1 flex flex-col justify-center text-center">
                <h2 className="text-lg font-bold mb-4" style={{ color: '#fafafa' }}>Your Earnings</h2>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="rounded-xl p-4" style={{ background: '#0f0f11' }}><div className="text-xl font-bold" style={{ color: '#22d3ee' }}>{yourReward}</div><div className="text-xs" style={{ color: '#a1a1aa' }}>DVX this trip</div></div>
                  <div className="rounded-xl p-4" style={{ background: '#0f0f11' }}><div className="text-xl font-bold" style={{ color: '#22d3ee' }}>{idealReward}</div><div className="text-xs" style={{ color: '#a1a1aa' }}>DVX if perfect</div></div>
                  <div className="rounded-xl p-4" style={{ background: '#0f0f11' }}><div className="text-xl font-bold" style={{ color: '#a78bfa' }}>{(yourReward * 100).toFixed(0)}</div><div className="text-xs" style={{ color: '#a1a1aa' }}>DVX / 100 trips</div></div>
                  <div className="rounded-xl p-4" style={{ background: '#0f0f11' }}><div className="text-xl font-bold" style={{ color: '#34d399' }}>70%</div><div className="text-xs" style={{ color: '#a1a1aa' }}>Revenue share</div></div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setStep(0); setEmail(''); setConsented(false); setTripFrom(''); setTripTo(''); }}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#27272a', color: '#a1a1aa' }}>Try Again</button>
                  <a href="https://x.com/drivx_" target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium text-center" style={{ background: '#6366f1', color: '#fff' }}>Follow for Launch</a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-between items-center">
          {step > 0 ? <button onClick={() => setStep(step - 1)} className="text-sm" style={{ color: '#a1a1aa' }}>← Back</button> : <div />}
          <Link href="/explore" className="text-sm" style={{ color: '#a1a1aa' }}>← Back to Explore</Link>
        </div>
      </div>
    </div>
  );
}
