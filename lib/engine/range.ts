import { addDays, diffDays, isDayKey, monthEnd, monthStart, todayKey, weekEnd, weekStart } from '@/lib/dates';

export interface Range {
  from: string;
  to: string;
}

export interface ResolvedRange extends Range {
  preset: 'today' | 'week' | 'month' | 'custom';
  prev: Range;
}

/** Resolve ?preset=today|week|month|custom&from=&to= in Pacific time. */
export function resolveRange(sp: URLSearchParams, now = Date.now()): ResolvedRange {
  const t = todayKey(now);
  let preset = (sp.get('preset') ?? 'week') as ResolvedRange['preset'];
  if (!['today', 'week', 'month', 'custom'].includes(preset)) preset = 'week';

  let from = weekStart(t);
  let to = weekEnd(t);
  if (preset === 'today') { from = t; to = t; }
  else if (preset === 'month') { from = monthStart(t); to = monthEnd(t); }
  else if (preset === 'custom') {
    const f = sp.get('from');
    const e = sp.get('to');
    if (isDayKey(f) && isDayKey(e)) { from = f <= e ? f : e; to = f <= e ? e : f; }
    else preset = 'week';
  }

  let prev: Range;
  if (preset === 'month') {
    const pEnd = addDays(from, -1);
    prev = { from: monthStart(pEnd), to: pEnd };
  } else {
    const len = diffDays(from, to) + 1;
    prev = { from: addDays(from, -len), to: addDays(from, -1) };
  }
  return { from, to, preset, prev };
}

export const inRange = (day: string | undefined, r: Range) => !!day && day >= r.from && day <= r.to;
