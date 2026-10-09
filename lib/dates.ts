import type { Dt } from './types';

export const TZ = 'America/Los_Angeles';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function wall(ms: number) {
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Pacific offset (ms, normally negative) at an instant. */
function offsetMs(ms: number): number {
  const w = wall(ms);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
}

/** Convert a Pacific wall-clock time to a UTC timestamp. */
export function wallToUtc(y: number, m: number, d: number, h = 0, mi = 0, s = 0): number {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  let ts = guess - offsetMs(guess);
  ts = guess - offsetMs(ts);
  return ts;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKeyOf(ts: number): string {
  const w = wall(ts);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}`;
}

export function todayKey(now = Date.now()): string {
  return dayKeyOf(now);
}

function make(y: number, m: number, d: number, h = 0, mi = 0, s = 0): Dt | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1) return null; // e.g. 31 Feb
  return { day: `${y}-${pad(m)}-${pad(d)}`, ts: wallToUtc(y, m, d, h, mi, s) };
}

export type DateOrder = 'DMY' | 'MDY';

/**
 * Parse whatever the sheet contains:
 *  - real dates (Google serial numbers; request SERIAL_NUMBER from the API)
 *  - ISO strings (with or without offset)
 *  - typed text like 24/9/2025 (day-first) or 9/24/2025 (month-first)
 * Wall-clock values without an offset are treated as Pacific time.
 */
export function parseDate(v: unknown, ambiguous: DateOrder = 'DMY'): Dt | null {
  if (v === null || v === undefined || v === '') return null;

  if (typeof v === 'number') {
    if (!isFinite(v) || v < 20000 || v > 80000) return null;
    const d = new Date(Math.round((v - 25569) * 86400) * 1000);
    return make(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
    );
  }

  const s = String(v).trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return parseDate(Number(s), ambiguous);

  // ISO with an explicit offset: exact instant.
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const ts = Date.parse(s);
    return isNaN(ts) ? null : { day: dayKeyOf(ts), ts };
  }

  const m = s.match(
    /^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/,
  );
  if (m) {
    const [, a, b, c, hh, mm, ss, ap] = m;
    let y: number;
    let mo: number;
    let d: number;
    if (a.length === 4) {
      y = +a;
      mo = +b;
      d = +c;
    } else {
      y = c.length === 2 ? 2000 + +c : +c;
      const x = +a;
      const z = +b;
      if (x > 12) {
        d = x;
        mo = z;
      } else if (z > 12) {
        mo = x;
        d = z;
      } else if (ambiguous === 'DMY') {
        d = x;
        mo = z;
      } else {
        mo = x;
        d = z;
      }
    }
    let h = hh ? +hh : 0;
    if (ap) {
      const pm = ap.toLowerCase() === 'pm';
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
    }
    return make(y, mo, d, h, mm ? +mm : 0, ss ? +ss : 0);
  }

  // Text such as "Sep 24, 2025 3:15 PM".
  const t = new Date(s);
  if (!isNaN(t.getTime())) {
    return make(t.getFullYear(), t.getMonth() + 1, t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds());
  }
  return null;
}

// ---- day-key arithmetic (calendar maths on YYYY-MM-DD strings) ----

const toUtc = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));

export function addDays(day: string, n: number): string {
  const d = new Date(toUtc(day) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const dow = (new Date(toUtc(day)).getUTCDay() + 6) % 7; // Mon=0
  return addDays(day, -dow);
}

export const weekEnd = (day: string) => addDays(weekStart(day), 6);

export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function monthEnd(day: string): string {
  const y = +day.slice(0, 4);
  const m = +day.slice(5, 7);
  return addDays(`${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01`, -1);
}

export function isDayKey(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
