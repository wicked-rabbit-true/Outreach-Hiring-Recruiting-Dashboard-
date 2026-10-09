import { NextResponse } from 'next/server';
import { cookieOptions, createToken, roleForPassword } from '@/lib/auth';
import { json, sameOrigin } from '@/lib/api';
import { settings } from '@/settings/settings';

export const dynamic = 'force-dynamic';

// Best-effort brute-force brake (per server instance).
const attempts = new Map<string, { n: number; reset: number }>();

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Bad origin' }, 403);
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const a = attempts.get(ip);
  if (a && a.reset > Date.now() && a.n >= 10) return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429);

  let password = '';
  try {
    password = String((await req.json()).password ?? '');
  } catch {
    return json({ error: 'Enter a password.' }, 400);
  }

  let role = null;
  try {
    role = await roleForPassword(password);
  } catch (e) {
    console.error(e);
    return json({ error: 'Login is not configured on the server.' }, 500);
  }

  if (!role) {
    const cur = a && a.reset > Date.now() ? a : { n: 0, reset: Date.now() + 10 * 60 * 1000 };
    cur.n++;
    attempts.set(ip, cur);
    await new Promise((r) => setTimeout(r, 400));
    return json({ error: 'Wrong password.' }, 401);
  }

  attempts.delete(ip);
  const res = NextResponse.json({ role });
  res.cookies.set(settings.session.cookie, await createToken(role), cookieOptions());
  return res;
}
