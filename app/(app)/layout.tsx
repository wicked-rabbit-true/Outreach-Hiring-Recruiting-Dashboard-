import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import Shell from '@/components/Shell';
import { verifyToken } from '@/lib/auth';
import { settings } from '@/settings/settings';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const role = await verifyToken(cookies().get(settings.session.cookie)?.value).catch(() => null);
  if (!role) return redirect('/login');
  const name = role === 'master' ? settings.session.masterDisplayName : 'Sales managers';
  return (
    <Shell role={role} name={name}>
      {children}
    </Shell>
  );
}
