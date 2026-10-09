// Server-side guards used by every route handler. Roles are enforced here, not in the UI.
import { NextResponse } from 'next/server';
import { cookieFromHeader, verifyToken } from '@/lib/auth';
import type { Role } from '@/lib/types';

export async function sessionRole(req: Request): Promise<Role | null> {
  try {
    return await verifyToken(cookieFromHeader(req.headers.get('cookie')));
  } catch {
    return null;
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Require a signed-in session; `master` additionally requires the master role. */
export async function guard(req: Request, need: Role = 'viewer'): Promise<{ role: Role } | { res: NextResponse }> {
  const role = await sessionRole(req);
  if (!role) return { res: json({ error: 'Not signed in' }, 401) };
  if (need === 'master' && role !== 'master') return { res: json({ error: 'Master access required' }, 403) };
  return { role };
}

/** Block cross-site writes (cookies are SameSite=Lax; this is a second layer). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host'));
  } catch {
    return false;
  }
}

export function fail(err: unknown) {
  console.error(err);
  return json({ error: 'Something went wrong while reading or writing the sheet.' }, 500);
}
