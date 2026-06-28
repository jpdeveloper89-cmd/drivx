'use client';
import { useState } from 'react';
import Link from 'next/link';
import { TripMap } from '@/components/TripMap';

const gradeColors: Record<string, string> = { A: '#34d399', B: '#22d3ee', C: '#a78bfa', D: '#fb923c', F: '#f87171' };

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
  const [loading, setLoading] = useState(false);

  // Scoring
  const speedScore = Math.round(1000 * (1 - Math.min(overspeeding / 5, 1)));
  const brakingScore = Math.round(1000 * (1 - Math.min(harshBraking / 4, 1)));
  const phoneScore = Math.round(1000 * (1 - Math.min(phoneMinutes / 3, 1)));
  const cornerScore = Math.round(1000 * (1 - Math.min(unsafeTurns / 3, 1)));
  const yourScore = Math.round(speedScore * 0.25 + brakingScore * 0.20 + 900 * 0.15 + cornerScore * 0.15 + phoneScore * 0.15 + 1000 * 0.10);
  const yourGrade = yourScore >= 900 ? 'A' : yourScore >= 800 ? 'B' : yourScore >= 700 ? 'C' : yourScore >= 600 ? 'D' : 'F';
  const yourReward = Math.round((yourScore / 1000) * 50 * 100) / 100;

  // Route sim
  const seed = (tripFrom + tripTo).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const distance = tripFrom ? 3 + (seed % 25) : 0;
  const duration = Math.round(distance * 2 + (seed % 10));

  function handleSubmitTrip() {
    setLoading(true);
    setTimeout(() => { setLoading(false); setStep(4); }, 1500);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10 px-4">

      {/* Phone frame */}
      <div className="relative" style={{ width: 360, maxWidth: '100%' }}>
        <div className="rounded-[44px] border-[3px] overflow-hidden"
          style={{ borderColor: '#3f3f46', background: '#09090b', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
          {/* Notch */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-28 h-5 rounded-full" style={{ background: '#1f1f23' }} />
          </div>

          {/* Screen */}
          <div className="px-5 pb-6" style={{ minHeight: 580 }}>

            {/* Step 0: Welcome + Register */}
            {step === 0 && (
              <div className="flex flex-col items-center pt-10">
                <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <span className="text-2xl">🚗</span>
                </div>
                <div className="text-lg font-bold mb-1" style={{ color: '#fafafa' }}>Welcome to DrivX</div>
                <div className="text-xs text-center mb-1" style={{ color: '#a1a1aa' }}>Safe driving earns you money</div>
                <div className="text-xs text-center mb-6 px-3 py-1 rounded-full"
                  style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)', color: '#fb923c' }}>
                  Interactive Demo
                </div>
                <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl text-sm outline-none mb-3"
                  style={{ background: '#1a1a1e', border: '1px solid #27272a', color: '#fafafa' }} />
                <button onClick={() => email.includes('@') && setStep(1)}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: email.includes('@') ? '#6366f1' : '#27272a', color: email.includes('@') ? '#fff' : '#71717a' }}>
                  Create Account
                </button>
                <div className="text-xs mt-4 text-center" style={{ color: '#71717a' }}>
                  No wallet needed · No seed phrase · Account Abstraction on Base
                </div>
              </div>
            )}

            {/* Step 1: Consent */}
            {step === 1 && (
              <div className="flex flex-col pt-6">
                <div className="text-base font-bold mb-1" style={{ color: '#fafafa' }}>Data Consent</div>
                <div className="text-xs mb-5" style={{ color: '#a1a1aa' }}>DrivX needs sensor access to score your driving. You control who sees your data.</div>
                <div className="space-y-2 mb-5">
                  {[
                    { icon: '📍', label: 'GPS location', desc: 'Encrypted with your key (AES-256)' },
                    { icon: '⚡', label: 'Speed & acceleration', desc: 'For scoring — never shared without consent' },
                    { icon: '📱', label: 'Phone screen state', desc: 'Detects phone usage while driving' },
                    { icon: '🕐', label: 'Trip timing', desc: 'Duration and time-of-day risk factor' },
                  ].map((d) => (
                    <div key={d.label} className="flex gap-3 p-3 rounded-xl" style={{ background: '#1a1a1e' }}>
                      <span className="text-lg">{d.icon}</span>
                      <div>
                        <div className="text-xs font-medium" style={{ color: '#fafafa' }}>{d.label}</div>
                        <div className="text-xs" style={{ color: '#71717a' }}>{d.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
                  <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="w-4 h-4" style={{ accentColor: '#6366f1' }} />
                  <span className="text-xs" style={{ color: '#fafafa' }}>I consent to data collection for safety scoring</span>
                </label>
                <button onClick={() => consented && setStep(2)}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold"
                  style={{ background: consented ? '#6366f1' : '#27272a', color: consented ? '#fff' : '#71717a' }}>
                  Continue
                </button>
              </div>
            )}

            {/* Step 2: Start Trip */}
            {step === 2 && (
              <div className="flex flex-col pt-6">
                <div className="text-base font-bold mb-1" style={{ color: '#fafafa' }}>Start a Trip</div>
                <div className="text-xs mb-5" style={{ color: '#a1a1aa' }}>In the real app, trips auto-detect. For this demo, enter your route manually.</div>
                <div className="mb-3">
                  <label className="text-xs mb-1 block" style={{ color: '#71717a' }}>Pickup / Start</label>
                  <input type="text" placeholder="e.g. Home, Mumbai" value={tripFrom} onChange={(e) => setTripFrom(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#1a1a1e', border: '1px solid #27272a', color: '#fafafa' }} />
                </div>
                <div className="mb-5">
                  <label className="text-xs mb-1 block" style={{ color: '#71717a' }}>Destination</label>
                  <input type="text" placeholder="e.g. Office, Bandra" value={tripTo} onChange={(e) => setTripTo(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: '#1a1a1e', border: '1px solid #27272a', color: '#fafafa' }} />
                </div>
                <button onClick={() => tripFrom.trim() && tripTo.trim() && setStep(3)}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold"
                  style={{ background: tripFrom && tripTo ? '#22d3ee' : '#27272a', color: tripFrom && tripTo ? '#09090b' : '#71717a' }}>
                  Start Trip →
                </button>
              </div>
            )}

            {/* Step 3: Driving behaviour */}
            {step === 3 && (
              <div className="flex flex-col pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />
                  <span className="text-xs font-medium" style={{ color: '#22d3ee' }}>Trip in progress</span>
                </div>
                <div className="text-xs mb-4" style={{ color: '#a1a1aa' }}>{tripFrom} → {tripTo} · {distance} km · ~{duration} min</div>

                {/* Real interactive map */}
                <div className="rounded-xl mb-4 relative overflow-hidden" style={{ height: 160, border: '1px solid #27272a' }}>
                  <TripMap from={tripFrom} to={tripTo} incidents={[
                    ...(overspeeding > 0 ? [{ type: 'speed', position: 0.3 }] : []),
                    ...(harshBraking > 0 ? [{ type: 'brake', position: 0.5 }] : []),
                    ...(phoneMinutes > 0 ? [{ type: 'phone', position: 0.7 }] : []),
                    ...(unsafeTurns > 0 ? [{ type: 'turn', position: 0.4 }] : []),
                  ]} />
                  <div className="absolute bottom-2 left-2 z-[1000] text-xs px-2 py-0.5 rounded-md" style={{ background: 'rgba(9,9,11,0.9)', color: '#22d3ee' }}>{tripFrom}</div>
                  <div className="absolute top-2 right-2 z-[1000] text-xs px-2 py-0.5 rounded-md" style={{ background: 'rgba(9,9,11,0.9)', color: '#34d399' }}>{tripTo}</div>
                </div>

                <div className="text-xs font-medium mb-3" style={{ color: '#fafafa' }}>How was your driving?</div>
                <div className="space-y-2.5 mb-4">
                  {[
                    { label: 'Times over speed limit', val: overspeeding, set: setOverspeeding },
                    { label: 'Harsh braking events', val: harshBraking, set: setHarshBraking },
                    { label: 'Phone use (minutes)', val: phoneMinutes, set: setPhoneMinutes },
                    { label: 'Unsafe turns', val: unsafeTurns, set: setUnsafeTurns },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#a1a1aa' }}>{f.label}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => f.set(Math.max(0, f.val - 1))} className="w-6 h-6 rounded-md flex items-center justify-center text-xs" style={{ background: '#27272a', color: '#fafafa' }}>-</button>
                        <span className="text-sm font-bold w-5 text-center" style={{ color: '#fafafa' }}>{f.val}</span>
                        <button onClick={() => f.set(Math.min(10, f.val + 1))} className="w-6 h-6 rounded-md flex items-center justify-center text-xs" style={{ background: '#27272a', color: '#fafafa' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={handleSubmitTrip}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#6366f1', color: '#fff' }}>
                  {loading ? 'Scoring trip...' : 'End Trip & Score'}
                </button>
              </div>
            )}

            {/* Step 4: Results */}
            {step === 4 && (
              <div className="flex flex-col pt-4 overflow-y-auto" style={{ maxHeight: 540 }}>
                <div className="text-base font-bold mb-3 text-center" style={{ color: '#fafafa' }}>Trip Complete ✓</div>

                {/* Route map with incidents */}
                <div className="rounded-xl mb-3 relative overflow-hidden" style={{ background: '#1a1a1e', border: '1px solid #27272a', height: 140 }}>
                  {/* Map grid lines */}
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#27272a 1px, transparent 1px), linear-gradient(90deg, #27272a 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                  {/* Route line */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 140" preserveAspectRatio="none">
                    <path d="M30 110 C80 90 100 30 150 50 S200 80 250 30" stroke="#6366f1" strokeWidth="3" fill="none" />
                    {/* Start point */}
                    <circle cx="30" cy="110" r="6" fill="#22d3ee" />
                    <circle cx="30" cy="110" r="3" fill="#09090b" />
                    {/* End point */}
                    <circle cx="250" cy="30" r="6" fill="#34d399" />
                    <circle cx="250" cy="30" r="3" fill="#09090b" />
                    {/* Incident markers */}
                    {overspeeding > 0 && <><circle cx="100" cy="32" r="8" fill="rgba(239,68,68,0.3)" /><circle cx="100" cy="32" r="4" fill="#f87171" /><text x="100" y="52" textAnchor="middle" fill="#f87171" fontSize="7">Speed</text></>}
                    {harshBraking > 0 && <><circle cx="150" cy="50" r="8" fill="rgba(251,146,60,0.3)" /><circle cx="150" cy="50" r="4" fill="#fb923c" /><text x="150" y="70" textAnchor="middle" fill="#fb923c" fontSize="7">Brake</text></>}
                    {phoneMinutes > 0 && <><circle cx="200" cy="62" r="8" fill="rgba(167,139,250,0.3)" /><circle cx="200" cy="62" r="4" fill="#a78bfa" /><text x="200" y="82" textAnchor="middle" fill="#a78bfa" fontSize="7">Phone</text></>}
                    {unsafeTurns > 0 && <><circle cx="120" cy="55" r="8" fill="rgba(34,211,238,0.3)" /><circle cx="120" cy="55" r="4" fill="#22d3ee" /><text x="120" y="75" textAnchor="middle" fill="#22d3ee" fontSize="7">Turn</text></>}
                  </svg>
                  {/* Labels */}
                  <div className="absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(9,9,11,0.8)', color: '#22d3ee' }}>{tripFrom}</div>
                  <div className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(9,9,11,0.8)', color: '#34d399' }}>{tripTo}</div>
                </div>

                {/* Trip stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="rounded-lg p-2 text-center" style={{ background: '#1a1a1e' }}>
                    <div className="text-sm font-bold" style={{ color: '#fafafa' }}>{distance} km</div>
                    <div className="text-xs" style={{ color: '#71717a' }}>Distance</div>
                  </div>
                  <div className="rounded-lg p-2 text-center" style={{ background: '#1a1a1e' }}>
                    <div className="text-sm font-bold" style={{ color: '#fafafa' }}>{duration} min</div>
                    <div className="text-xs" style={{ color: '#71717a' }}>Duration</div>
                  </div>
                  <div className="rounded-lg p-2 text-center" style={{ background: '#1a1a1e' }}>
                    <div className="text-sm font-bold" style={{ color: '#fafafa' }}>{Math.round(distance / (duration / 60))} km/h</div>
                    <div className="text-xs" style={{ color: '#71717a' }}>Avg speed</div>
                  </div>
                </div>

                {/* Score comparison */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-xl p-3 text-center" style={{ background: '#1a1a1e', border: `2px solid ${gradeColors[yourGrade]}30` }}>
                    <div className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Your Score</div>
                    <div className="text-3xl font-bold" style={{ color: '#fafafa' }}>{yourScore}</div>
                    <div className="text-sm font-bold" style={{ color: gradeColors[yourGrade] }}>Grade {yourGrade}</div>
                    <div className="text-xs mt-1" style={{ color: '#22d3ee' }}>{yourReward} DVX</div>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: '#1a1a1e', border: '2px solid rgba(34,211,238,0.2)' }}>
                    <div className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Ideal Score</div>
                    <div className="text-3xl font-bold" style={{ color: '#fafafa' }}>970</div>
                    <div className="text-sm font-bold" style={{ color: '#34d399' }}>Grade A</div>
                    <div className="text-xs mt-1" style={{ color: '#22d3ee' }}>48.5 DVX</div>
                  </div>
                </div>

                {/* Incidents summary */}
                {(overspeeding > 0 || harshBraking > 0 || phoneMinutes > 0 || unsafeTurns > 0) && (
                  <div className="rounded-xl p-3 mb-3" style={{ background: '#1a1a1e' }}>
                    <div className="text-xs font-medium mb-2" style={{ color: '#fb923c' }}>Incidents on this trip:</div>
                    <div className="space-y-1.5">
                      {overspeeding > 0 && <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f87171' }} /><span className="text-xs" style={{ color: '#a1a1aa' }}>Overspeeding ×{overspeeding}</span></div><span className="text-xs font-bold" style={{ color: '#f87171' }}>-{1000 - speedScore} pts</span></div>}
                      {harshBraking > 0 && <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#fb923c' }} /><span className="text-xs" style={{ color: '#a1a1aa' }}>Harsh braking ×{harshBraking}</span></div><span className="text-xs font-bold" style={{ color: '#fb923c' }}>-{1000 - brakingScore} pts</span></div>}
                      {phoneMinutes > 0 && <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#a78bfa' }} /><span className="text-xs" style={{ color: '#a1a1aa' }}>Phone use {phoneMinutes} min</span></div><span className="text-xs font-bold" style={{ color: '#a78bfa' }}>-{1000 - phoneScore} pts</span></div>}
                      {unsafeTurns > 0 && <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#22d3ee' }} /><span className="text-xs" style={{ color: '#a1a1aa' }}>Unsafe turns ×{unsafeTurns}</span></div><span className="text-xs font-bold" style={{ color: '#22d3ee' }}>-{1000 - cornerScore} pts</span></div>}
                    </div>
                  </div>
                )}

                {/* Leaderboard position */}
                <div className="rounded-xl p-3 mb-3" style={{ background: '#1a1a1e' }}>
                  <div className="text-xs font-medium mb-2" style={{ color: '#fafafa' }}>Leaderboard</div>
                  <div className="space-y-1">
                    {[{ rank: 1, name: 'Driver_Mumbai', score: 982 }, { rank: 2, name: 'SafeCommuter', score: 971 }, { rank: 3, name: 'NightOwl', score: 961 }].map((d) => (
                      <div key={d.rank} className="flex items-center justify-between py-1">
                        <span className="text-xs" style={{ color: '#a1a1aa' }}>#{d.rank} {d.name}</span>
                        <span className="text-xs font-bold" style={{ color: '#22d3ee' }}>{d.score}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-1 px-2 -mx-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)' }}>
                      <span className="text-xs font-bold" style={{ color: '#fb923c' }}>You ({email.split('@')[0] || 'demo'})</span>
                      <span className="text-xs font-bold" style={{ color: gradeColors[yourGrade] }}>{yourScore}</span>
                    </div>
                  </div>
                </div>

                {/* Revenue summary */}
                <div className="rounded-xl p-4 mb-3 text-center"
                  style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(99,102,241,0.08))', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <div className="text-xs mb-1" style={{ color: '#a1a1aa' }}>Total Revenue Earned</div>
                  <div className="text-3xl font-bold mb-0.5" style={{ color: '#22d3ee' }}>{yourReward} DVX</div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div><div className="text-sm font-bold" style={{ color: '#fafafa' }}>1</div><div className="text-xs" style={{ color: '#71717a' }}>Trips</div></div>
                    <div><div className="text-sm font-bold" style={{ color: '#fafafa' }}>{(yourReward * 100).toFixed(0)}</div><div className="text-xs" style={{ color: '#71717a' }}>DVX/100 trips</div></div>
                    <div><div className="text-sm font-bold" style={{ color: '#34d399' }}>70%</div><div className="text-xs" style={{ color: '#71717a' }}>Staker share</div></div>
                  </div>
                </div>

                {/* Testnet link */}
                <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#34d399' }} />
                    <span className="text-xs font-medium" style={{ color: '#34d399' }}>Recorded on Base Sepolia</span>
                  </div>
                  <a href="https://sepolia.basescan.org/address/0x0A1E6C8B6EcF597a12031C55a626dfBcC5877Dce" target="_blank" rel="noopener noreferrer"
                    className="text-xs" style={{ color: '#22d3ee' }}>
                    View SafetyRegistry on Basescan ↗
                  </a>
                </div>

                <button onClick={() => { setStep(0); setEmail(''); setConsented(false); setTripFrom(''); setTripTo(''); setOverspeeding(2); setHarshBraking(1); setPhoneMinutes(1); setUnsafeTurns(0); }}
                  className="w-full py-3 rounded-xl text-sm font-semibold mb-2"
                  style={{ background: '#6366f1', color: '#fff' }}>
                  Try Another Trip
                </button>
                <a href="https://x.com/drivx_" target="_blank" rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl text-sm font-semibold text-center block"
                  style={{ background: '#1a1a1e', border: '1px solid #27272a', color: '#a1a1aa' }}>
                  Follow @drivx_ for Launch
                </a>
              </div>
            )}

          </div>
          {/* Home indicator */}
          <div className="flex justify-center pb-2">
            <div className="w-24 h-1 rounded-full" style={{ background: '#3f3f46' }} />
          </div>
        </div>
      </div>

      {/* Back link + step indicator outside phone */}
      <div className="mt-6 text-center">
        {step > 0 && step < 4 && (
          <button onClick={() => setStep(step - 1)} className="text-xs mb-2 block mx-auto" style={{ color: '#a1a1aa' }}>← Back</button>
        )}
        <div className="text-xs" style={{ color: '#71717a' }}>Step {step + 1} of 5</div>
        <Link href="/explore" className="text-xs mt-2 block" style={{ color: '#71717a' }}>Back to Explore</Link>
      </div>
    </div>
  );
}
