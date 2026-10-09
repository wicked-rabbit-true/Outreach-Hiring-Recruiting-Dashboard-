'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Role } from '@/lib/types';
import { branding } from '@/settings/public';
import { RoleProvider } from './Session';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/managers', label: 'Managers' },
];

export default function Shell({ role, name, children }: { role: Role; name: string; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.assign('/login');
  }

  return (
    <RoleProvider value={role}>
      <div className="shell">
        <aside className="side">
          <div className="brand">
            <span className="brand-mark" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z" />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z" />
              </svg>
            </span>
            <span>
              <strong>{branding.name}</strong>
              <small>{branding.subtitle}</small>
            </span>
          </div>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={path.startsWith(n.href) ? 'on' : ''} aria-current={path.startsWith(n.href) ? 'page' : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="side-foot">
            <div className="live"><i /> Live data, refreshes every 2 min</div>
            <div className="who">
              <strong>{name}</strong>
              <small>{role === 'master' ? 'Master access' : 'View only'}</small>
              <button onClick={logout} className="link-btn">Sign out</button>
            </div>
          </div>
        </aside>
        <main className="main">{children}</main>
      </div>
    </RoleProvider>
  );
}
