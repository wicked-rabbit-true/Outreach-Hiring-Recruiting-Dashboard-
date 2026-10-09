export const money = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : '$' + Math.round(n).toLocaleString('en-US');

export const pct = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? '—' : `${n.toFixed(digits)}%`;

export function ago(ts: number, now = Date.now()): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const TZ = 'America/Los_Angeles';

export const timeLabel = (ts: number) =>
  ts ? new Date(ts).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) : '—';

export const dateLabel = (ts: number) =>
  ts ? new Date(ts).toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }) : '—';

/** "2026-10-05" -> "Oct 5" */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
}
