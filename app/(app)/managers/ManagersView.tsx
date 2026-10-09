'use client';
import { useState } from 'react';
import { useRole } from '@/components/Session';
import { Loading } from '@/components/ui';
import type { managersView } from '@/lib/engine/metrics';
import { ago, dateLabel, dayLabel } from '@/lib/format';
import { postJson, useApi } from '@/lib/client/useApi';

type Data = ReturnType<typeof managersView>;

export default function ManagersView() {
  const { data, error, reload } = useApi<Data>('/api/managers');
  const role = useRole();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function assign(personId: string, manager: string) {
    if (!manager) return;
    setBusy(personId);
    setErr('');
    try {
      await postJson('/api/assign', { personId, manager });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not assign');
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <Loading error={error} />;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Who got which recruits</h1>
          <p className="sub">Visible to every manager in the campaign</p>
        </div>
      </header>
      {error && <div className="banner warn">Showing the last loaded data. {error}</div>}

      <section className="card" aria-labelledby="res-h">
        <h2 id="res-h">Results by manager, last 90 days</h2>
        <div className="scroll">
          <table className="list">
            <thead><tr><th>Manager</th><th className="num">Assigned</th><th className="num">Started</th><th className="num">Active at 30 days</th><th className="num">Start rate</th></tr></thead>
            <tbody>
              {data.table.map((r) => (
                <tr key={r.manager}>
                  <td><strong>{r.manager}</strong></td>
                  <td className="num">{r.assigned}</td>
                  <td className="num">{r.started}</td>
                  <td className="num">{r.activeAt30 === null ? '—' : `${r.activeAt30}%`}</td>
                  <td className="num">{r.startRate === null ? '—' : `${r.startRate}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="cols">
        {role === 'master' && (
          <section className="card master-card" aria-labelledby="ready-h">
            <h2 id="ready-h">Ready to assign <b className="tag">Master</b></h2>
            {err && <div className="err">{err}</div>}
            {data.ready.length === 0 && <p className="muted">Everyone who showed has a manager.</p>}
            <ul className="ready">
              {data.ready.map((r) => (
                <li key={r.id}>
                  <span>
                    <strong>{r.name}</strong>
                    <small>{[r.market, `showed ${ago(r.showedAt)}`].filter(Boolean).join(' · ')}</small>
                  </span>
                  <select aria-label={`Assign ${r.name}`} disabled={busy === r.id} value="" onChange={(e) => assign(r.id, e.target.value)}>
                    <option value="">{busy === r.id ? 'Assigning…' : 'Assign to…'}</option>
                    {data.managers.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card" aria-labelledby="log-h">
          <h2 id="log-h">Assignment log</h2>
          <div className="scroll">
            <table className="list">
              <thead><tr><th>Recruit</th><th>Manager</th><th>Date</th><th>Assigned by</th></tr></thead>
              <tbody>
                {data.log.map((l, i) => (
                  <tr key={`${l.personId}-${i}`}>
                    <td><strong>{l.name}</strong></td>
                    <td>{l.manager}</td>
                    <td>{l.ts ? dateLabel(l.ts) : '—'}</td>
                    <td>{l.by || '—'}</td>
                  </tr>
                ))}
                {data.log.length === 0 && <tr><td colSpan={4} className="muted">No assignments yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted small">Window: {dayLabel(data.windowFrom)} – {dayLabel(data.windowTo)}</p>
        </section>
      </div>
    </>
  );
}
