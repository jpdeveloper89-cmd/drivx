import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center text-center px-8 py-32">
      <div className="text-5xl mb-6">📖</div>
      <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#a1a1aa' }}>
        Phase 3 — Q1 2027
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-4" style={{ color: '#fafafa' }}>
        API Documentation
      </h1>
      <p className="text-lg max-w-md leading-relaxed mb-8" style={{ color: '#a1a1aa' }}>
        OpenAPI 3.0 docs, interactive sandbox, and integration guides for
        Safety Registry, Insurance Verification, and Marketplace APIs.
      </p>
      <div className="p-6 rounded-xl border border-border mb-8 text-left max-w-md w-full" style={{ background: '#111113' }}>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: '#6366f1' }}>Available endpoints (Phase 1–2)</div>
        {[
          'POST /api/v1/auth/register',
          'POST /api/v1/auth/login',
          'POST /api/v1/trips/submit',
          'GET  /api/v1/drivers/:address/score',
          'GET  /api/v1/consent/grants',
        ].map((ep) => (
          <div key={ep} className="py-2 border-b border-border">
            <code className="text-sm" style={{ color: '#22d3ee', fontFamily: '"Courier New", monospace' }}>{ep}</code>
          </div>
        ))}
      </div>
      <Link href="/" className="btn-secondary">← Back to Home</Link>
    </div>
  );
}
