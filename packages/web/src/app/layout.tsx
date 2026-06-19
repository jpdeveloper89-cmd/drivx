import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'DrivX Protocol',
  description: 'Safe driving earns you money. Build your score, earn DVX, share with insurers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#09090b', color: '#fafafa', minHeight: '100vh' }}>
        <div className="grid-bg" />
        <Nav />
        <main className="pt-16">{children}</main>
        <footer className="border-t border-border mt-20 py-10 px-8 flex justify-between items-center text-sm text-muted max-w-6xl mx-auto">
          <span style={{ color: '#a1a1aa' }}>© 2026 DrivX Protocol</span>
          <div className="flex gap-6">
            <a href="https://twitter.com/drivxprotocol" target="_blank" rel="noopener noreferrer"
              className="hover:text-text transition-colors" style={{ color: '#a1a1aa' }}>Twitter</a>
            <a href="https://github.com/jpdeveloper89-cmd" target="_blank" rel="noopener noreferrer"
              className="hover:text-text transition-colors" style={{ color: '#a1a1aa' }}>GitHub</a>
            <a href="/docs" className="hover:text-text transition-colors" style={{ color: '#a1a1aa' }}>API Docs</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
