import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { settings } from '@/settings/settings';

// First gate: every page and API route needs a valid signed session, except login.
// Route handlers re-check the role for each endpoint (master-only writes, raw quiz answers).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open = pathname === '/login' || pathname === '/api/login';
  let role = null;
  try {
    role = await verifyToken(req.cookies.get(settings.session.cookie)?.value);
  } catch {
    /* missing SESSION_SECRET -> treat as signed out */
  }

  if (open) {
    if (role && pathname === '/login') return NextResponse.redirect(new URL('/dashboard', req.url));
    return NextResponse.next();
  }
  if (role) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
