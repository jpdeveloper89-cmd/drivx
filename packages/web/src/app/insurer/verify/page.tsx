import Link from 'next/link';

export default function InsurerPortalPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center text-center px-8 py-32">
      <div className="text-5xl mb-6">🛡️</div>
      <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#a1a1aa' }}>
        Phase 3 — Q1 2027
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-4" style={{ color: '#fafafa' }}>
        Insurer Portal
      </h1>
      <p className="text-lg max-w-md leading-relaxed mb-8" style={{ color: '#a1a1aa' }}>
        Real-time Safety Score lookups, batch verification of up to 1,000 drivers,
        and consent-gated data access. Coming in Phase 3.
      </p>
      <div className="p-6 rounded-xl border border-border mb-8 text-left max-w-md w-full" style={{ background: '#111113' }}>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: '#6366f1' }}>What's coming</div>
        {[
          'POST /api/v1/verify/single — single driver lookup',
          'POST /api/v1/verify/batch — up to 1,000 addresses',
          'Risk categories: Low / Medium / High',
          '5 USDC fee per verification',
          'Consent-enforced — no data without driver approval',
        ].map((item) => (
          <div key={item} className="flex items-start gap-2 py-2 border-b border-border text-sm" style={{ color: '#a1a1aa' }}>
            <span style={{ color: '#22d3ee' }}>→</span> {item}
          </div>
        ))}
      </div>
      <Link href="/" className="btn-secondary">← Back to Home</Link>
    </div>
  );
}
