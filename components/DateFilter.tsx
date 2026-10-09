'use client';
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

/** Query string (preset/from/to) forwarded to the API. */
export function rangeQuery(sp: ReadonlyURLSearchParams): string {
  const out = new URLSearchParams();
  for (const k of ['preset', 'from', 'to']) {
    const v = sp.get(k);
    if (v) out.set(k, v);
  }
  return out.toString();
}

export default function DateFilter() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const preset = sp.get('preset') ?? 'week';

  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="datefilter">
      <div className="seg" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button key={p.id} className={preset === p.id ? 'on' : ''} onClick={() => go({ preset: p.id, ...(p.id === 'custom' ? {} : { from: null, to: null }) })}>
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="custom">
          <input type="date" aria-label="From" value={sp.get('from') ?? ''} onChange={(e) => go({ from: e.target.value, preset: 'custom' })} />
          <span>to</span>
          <input type="date" aria-label="To" value={sp.get('to') ?? ''} onChange={(e) => go({ to: e.target.value, preset: 'custom' })} />
        </div>
      )}
    </div>
  );
}
