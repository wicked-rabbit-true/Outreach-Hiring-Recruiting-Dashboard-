import type { ReactNode } from 'react';
import type { Tone } from '@/settings/public';

export const Pill = ({ tone, children }: { tone: Tone; children: ReactNode }) => <span className={`pill ${tone}`}>{children}</span>;

export function Loading({ error }: { error?: string | null }) {
  return <div className="state">{error ? <span className="err">{error}</span> : 'Loading…'}</div>;
}

export function Delta({ cur, prev, unit }: { cur: number | null; prev: number | null; unit?: 'pts' }) {
  if (cur === null || prev === null) return null;
  const d = cur - prev;
  if (Math.abs(d) < 0.05) return <span className="delta flat">no change</span>;
  const up = d > 0;
  const n = unit === 'pts' ? Math.abs(Math.round(d)) : Math.abs(Math.round(d));
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      {up ? '↑' : '↓'} {n}
      {unit === 'pts' ? ' pts' : ''}
    </span>
  );
}
