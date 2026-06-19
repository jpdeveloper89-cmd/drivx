'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const links = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/accountability', label: 'Accountability' },
  { href: '/community', label: 'Community' },
  { href: '/docs', label: 'API Docs' },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-border"
      style={{ background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-6xl mx-auto px-8 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-text">
          <Image src="/logo.png" alt="DrivX" width={32} height={32} className="rounded" />
          DrivX
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                'text-sm transition-colors',
                path === l.href ? 'text-text' : 'text-muted hover:text-text'
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/insurer/verify" className="btn-secondary text-sm py-2 px-4">
            Insurer Portal
          </Link>
          <Link href="/dashboard" className="btn-primary text-sm py-2 px-4">
            Business Portal
          </Link>
        </div>
      </div>
    </nav>
  );
}
