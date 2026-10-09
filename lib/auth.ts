// Signed-cookie sessions using Web Crypto, so the same code runs in middleware (edge) and route handlers.
import type { Role } from '@/lib/types';
import { env, settings } from '@/settings/settings';

const enc = new TextEncoder();

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

function secret(): string {
  // Literal access on purpose: dynamic process.env[...] does not work in the edge middleware.
  const s = process.env.SESSION_SECRET ?? '';
  if (s.length < 24) throw new Error('SESSION_SECRET must be set to a random string of 24+ characters');
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function sha256(s: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

/** Returns the role for a password, or null. Compares hashes in constant time. */
export async function roleForPassword(password: string): Promise<Role | null> {
  const given = await sha256(password);
  const master = env('masterPassword');
  const viewer = env('viewerPassword');
  let role: Role | null = null;
  if (master && safeEqual(given, await sha256(master))) role = 'master';
  else if (viewer && safeEqual(given, await sha256(viewer))) role = 'viewer';
  return role;
}

export async function createToken(role: Role): Promise<string> {
  const payload = b64url(JSON.stringify({ r: role, e: Date.now() + settings.session.hours * 3600 * 1000 }));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyToken(token: string | undefined | null): Promise<Role | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    if (!safeEqual(sig, await hmac(payload))) return null;
    const data = JSON.parse(unb64url(payload)) as { r: Role; e: number };
    if (!data.e || data.e < Date.now()) return null;
    return data.r === 'master' || data.r === 'viewer' ? data.r : null;
  } catch {
    return null;
  }
}

export function cookieFromHeader(header: string | null, name = settings.session.cookie): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: settings.session.hours * 3600,
});
