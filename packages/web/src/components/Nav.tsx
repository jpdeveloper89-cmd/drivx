'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const links = [
  { href: '/#how', label: 'How It Works' },
  { href: '/#tokenomics', label: 'Tokenomics' },
  { href: '/#roadmap', label: 'Roadmap' },
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
          <a href="https://jpdeveloper89-cmd.github.io/drivx/DrivX_Whitepaper.html" target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm py-2 px-4">
            Whitepaper
          </a>
          <a href="https://github.com/jpdeveloper89-cmd/drivx" target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm py-2 px-4">
            GitHub
          </a>
          <a href="https://x.com/drivx_" target="_blank" rel="noopener noreferrer" className="btn-primary text-sm py-2 px-4">
            Follow Us
          </a>
        </div>
      </div>
    </nav>
  );
}
