import { NextResponse } from 'next/server';
import { settings } from '@/settings/settings';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(settings.session.cookie, '', { path: '/', maxAge: 0 });
  return res;
}
