'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import DateFilter, { rangeQuery } from '@/components/DateFilter';
import { useRole } from '@/components/Session';
import { Loading, Pill } from '@/components/ui';
import type { leadDetail, leadsList } from '@/lib/engine/metrics';
import { ago, dateLabel, dayLabel, timeLabel } from '@/lib/format';
import { postJson, useApi } from '@/lib/client/useApi';

type List = ReturnType<typeof leadsList> & { range: { from: string; to: string } };
type Detail = NonNullable<ReturnType<typeof leadDetail>>;
type Question = Detail['questions'][number] & { answer?: string };

export default function LeadsView() {
  const sp = useSearchParams();
  const router = useRouter();
  const role = useRole();
  const stage = sp.get('stage') || 'leads';

  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [manager, setManager] = useState('');
  const [source, setSource] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDq(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams(rangeQuery(sp));
  params.set('stage', stage);
  if (dq) params.set('q', dq);
  if (manager) params.set('manager', manager);
  if (source) params.set('source', source);
  if (showHidden) params.set('hidden', '1');
  const { data, error, reload } = useApi<List>(`/api/leads?${params}`);

  function setStage(id: string) {
    const next = new URLSearchParams(sp.toString());
    next.set('stage', id);
    router.replace(`/leads?${next}`, { scroll: false });
  }

  if (!data) return <Loading error={error} />;
  const inTabs = data.tabs.some((t) => t.id === data.active);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Every lead and where they are</h1>
          <p className="sub">Pick a stage to filter. Click a lead to see their quiz result.</p>
        </div>
        <div className="head-right">
          <span className="updated">Last updated {dateLabel(data.lastUpdated)}, {timeLabel(data.lastUpdated)}</span>
          <DateFilter />
        </div>
      </header>
      {error && <div className="banner warn">Showing the last loaded data. {error}</div>}

      <div className="tabs" role="tablist" aria-label="Stage">
        {data.tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={data.active === t.id} className={data.active === t.id ? 'on' : ''} onClick={() => setStage(t.id)}>
            {t.label} <b>{t.count}</b>
          </button>
        ))}
        {!inTabs && <button className="on" role="tab" aria-selected>{data.activeLabel} <b>{data.total}</b></button>}
      </div>

      <div className="filters">
        <input type="search" placeholder="Search name, phone, email" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Manager" value={manager} onChange={(e) => setManager(e.target.value)}>
          <option value="">Manager: all</option>
          <option value="__none__">Unassigned</option>
          {data.managers.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Source: all</option>
          {data.sources.map((s) => <option key={s}>{s}</option>)}
        </select>
        {role === 'master' && (
          <label className="check"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Hidden leads ({data.hiddenCount})</label>
        )}
      </div>

      <div className={`split ${selected ? 'open' : ''}`}>
        <section className="card flush">
          <div className="scroll">
            <table className="list clickable">
              <thead>
                <tr><th>Lead</th><th>Stage</th><th>Latest dispo</th><th>Quiz</th><th>Manager</th><th>Received</th></tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className={selected === r.id ? 'sel' : ''} onClick={() => setSelected(r.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelected(r.id)}>
                    <td><strong>{r.name}</strong></td>
                    <td><Pill tone={r.tone}>{r.stage}</Pill></td>
                    <td>{r.latestDispo || '—'}</td>
                    <td>{r.quiz}</td>
                    <td>{r.manager || '—'}</td>
                    <td className="muted" title={`${dateLabel(r.received)} ${timeLabel(r.received)}`}>{ago(r.received)}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && <tr><td colSpan={6} className="muted">No leads match. Try another stage or date range ({dayLabel(data.range.from)} – {dayLabel(data.range.to)}).</td></tr>}
              </tbody>
            </table>
          </div>
          {data.total > data.rows.length && <p className="muted small pad">Showing the newest {data.rows.length} of {data.total}. Narrow the search to see the rest.</p>}
        </section>

        {selected && <DetailPanel id={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); reload(); }} />}
      </div>
    </>
  );
}

function DetailPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const role = useRole();
  const { data, error } = useApi<Detail>(`/api/leads/${id}`, 0);
  const [busy, setBusy] = useState(false);

  async function toggleHidden(hidden: boolean) {
    setBusy(true);
    try {
      await postJson('/api/hide', { personId: id, hidden });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="card panel" aria-label="Lead details">
      <div className="panel-head">
        <h2>{data?.name ?? 'Lead'}</h2>
        <button className="x" onClick={onClose} aria-label="Close details">×</button>
      </div>
      {!data ? <Loading error={error} /> : (
        <>
          <p className="panel-meta">
            <Pill tone={data.tone}>{data.stage}</Pill> {[data.market, data.source].filter(Boolean).join(' · ')}
          </p>
          <p className="muted small">
            {data.vsl ? `VSL watched ${data.vsl}` : 'VSL watched: not recorded'}
            {data.manager ? ` · Manager: ${data.manager}` : ' · No manager'}
            <br />Latest dispo: {data.latestDispo || '—'}
          </p>
          <h3>Quiz result by question</h3>
          <ol className="qlist">
            {(data.questions as Question[]).map((qn, i) => (
              <li key={qn.label}>
                <span>{i + 1}. {qn.label}</span>
                <span className={`res ${qn.result}`}>{qn.result === 'pass' ? '✓ Pass' : qn.result === 'fail' ? '✕ Fail' : '—'}</span>
                {role === 'master' && qn.answer && <span className="raw">{qn.answer}</span>}
              </li>
            ))}
          </ol>
          <p className="muted small">{role === 'master' ? 'Raw answers are shown because you are signed in as master.' : 'Managers see pass/fail. Raw answers are visible to master only.'}</p>
          {role === 'master' && (
            <button className="btn" disabled={busy} onClick={() => toggleHidden(!data.hidden)}>{data.hidden ? 'Restore lead' : 'Hide this lead (not a real applicant)'}</button>
          )}
        </>
      )}
    </aside>
  );
}
