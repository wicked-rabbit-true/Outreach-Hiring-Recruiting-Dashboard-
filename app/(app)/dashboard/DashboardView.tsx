'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import DateFilter, { rangeQuery } from '@/components/DateFilter';
import { useRole } from '@/components/Session';
import { Delta, Loading, Pill } from '@/components/ui';
import type { dashboard, weekly } from '@/lib/engine/metrics';
import { ago, dateLabel, dayLabel, money, pct, timeLabel } from '@/lib/format';
import { postJson, useApi } from '@/lib/client/useApi';

type Data = ReturnType<typeof dashboard> & {
  weekly: ReturnType<typeof weekly>;
  preset: string;
  testExcluded?: number;
};

const PREV_LABEL: Record<string, string> = { today: 'yesterday', week: 'last week', month: 'last month', custom: 'previous period' };

export default function DashboardView() {
  const sp = useSearchParams();
  const { data, error, reload } = useApi<Data>(`/api/dashboard?${rangeQuery(sp)}`);
  const role = useRole();
  if (!data) return <Loading error={error} />;

  const { current: c, previous: p } = data.kpis;
  const prevLabel = PREV_LABEL[data.preset] ?? 'previous period';

  return (
    <>
      <header className="page-head">
        <div>
          <h1>How the campaign is performing</h1>
          <p className="sub">All managers · this period vs {prevLabel} · every stage counted in the week it happened</p>
        </div>
        <div className="head-right">
          <span className="updated">Last updated {dateLabel(data.lastUpdated)}, {timeLabel(data.lastUpdated)}</span>
          <DateFilter />
        </div>
      </header>

      {error && <div className="banner warn">Showing the last loaded data. {error}</div>}
      {role === 'master' && data.warnings.length > 0 && (
        <div className="banner warn">
          <strong>Sheet check:</strong> {data.warnings.slice(0, 4).join(' ')}
        </div>
      )}

      <section className="kpis" aria-label="Key numbers">
        <Kpi label="New leads" value={String(c.newLeads)} delta={<Delta cur={c.newLeads} prev={p.newLeads} />} note={`vs ${p.newLeads} ${prevLabel}`} />
        <Kpi label="Quiz pass rate" value={pct(c.quizPassRate)} delta={<Delta cur={c.quizPassRate} prev={p.quizPassRate} unit="pts" />} note={`${c.passed} of ${c.completed} who finished`} />
        <Kpi label="Interviews booked" value={String(c.interviewsBooked)} delta={<Delta cur={c.interviewsBooked} prev={p.interviewsBooked} />} note="1st interviews" />
        <Kpi label="Show rate" value={pct(c.showRate)} delta={<Delta cur={c.showRate} prev={p.showRate} unit="pts" />} note={`${c.showed} showed · ${c.noShow} no-show`} />
        <Kpi label="Assigned" value={String(c.assigned)} delta={<Delta cur={c.assigned} prev={p.assigned} />} note="handed to a manager" />
        <Kpi label="Hires" value={String(c.hires)} delta={<Delta cur={c.hires} prev={p.hires} />} note="started training" />
      </section>

      <section className="roi" aria-label="Return on ad spend">
        <SpendCard roi={data.roi} master={role === 'master'} onSaved={reload} />
        <Kpi small label="Cost per lead" value={money(data.roi.costPerLead)} note="This week" />
        <Kpi small label="Cost per quiz-passer" value={money(data.roi.costPerPasser)} note="This week" />
        <Kpi small label="Cost per show" value={money(data.roi.costPerShow)} note="Last 4 weeks" />
        <Kpi small label="Cost per hire" value={money(data.roi.costPerHire)} note="Last 4 weeks" />
      </section>

      <div className="cols">
        <section className="card" aria-labelledby="funnel-h">
          <h2 id="funnel-h">Pipeline funnel, all stages</h2>
          <div className="funnel">
            {data.funnel.map((f) => (
              <div className="frow" key={f.stage}>
                <span className="flabel">{f.label}</span>
                <span className="ftrack">
                  <span className={`fbar ${f.stage === 'abandoned' || f.stage === 'disqualified' ? 'gray' : ''}`} style={{ width: `${Math.min(100, f.pct ?? 0)}%` }} />
                </span>
                <span className="fnum">{f.count}{f.pct !== null && <em> · {Math.round(f.pct)}%</em>}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="quiz-h">
          <h2 id="quiz-h">Quiz</h2>
          <div className="quiz-nums">
            <div><small>Completed</small><strong>{pct(data.quiz.completionRate)}</strong></div>
            <div><small>Passed</small><strong>{pct(data.quiz.passRate)}</strong></div>
            <div><small>Disqualified</small><strong>{data.quiz.disqualified}</strong></div>
          </div>
          <h3>Top disqualifying reasons</h3>
          {data.quiz.reasons.length === 0 && <p className="muted">No disqualifications in this period.</p>}
          {data.quiz.reasons.map((r) => (
            <div className="reason" key={r.step}>
              <span>Step {r.step} · {r.label}</span>
              <span className="rtrack"><span style={{ width: `${r.pct ?? 0}%` }} /></span>
              <span className="fnum">{Math.round(r.pct ?? 0)}%</span>
            </div>
          ))}
          <p className="muted small">Bad fits filtered out before they cost an interview.</p>
        </section>
      </div>

      <section className="card" aria-labelledby="week-h">
        <h2 id="week-h">Leads by stage, week by week</h2>
        <p className="muted small">Same layout as the Stats v2 tab. Each number is counted in the Monday–Sunday week it happened, one record per person. Click a number to see the leads.</p>
        <div className="scroll">
          <table className="grid">
            <thead>
              <tr>
                <th>Week</th>
                {data.weekly.columns.map((col) => <th key={col.stage} className="num">{col.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.weekly.rows.map((row) => (
                <tr key={row.weekStart}>
                  <td className="wk">{dayLabel(row.weekStart)} – {dayLabel(row.weekEnd)}</td>
                  {data.weekly.columns.map((col) => (
                    <td key={col.stage} className="num">
                      <Link href={`/leads?stage=${col.stage}&preset=custom&from=${row.weekStart}&to=${row.weekEnd}`}>{row.counts[col.stage]}</Link>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {data.weekly.columns.map((col) => <td key={col.stage} className="num">{data.weekly.totals[col.stage]}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="feed-h">
        <h2 id="feed-h">Live lead feed</h2>
        <div className="scroll">
          <table className="list">
            <thead><tr><th>Lead</th><th>Stage</th><th>Manager</th><th>Market</th><th>Received</th></tr></thead>
            <tbody>
              {data.feed.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.name}</strong></td>
                  <td><Pill tone={f.tone}>{f.stage}</Pill></td>
                  <td>{f.manager || '—'}</td>
                  <td>{f.market || '—'}</td>
                  <td className="muted">{ago(f.ts)}</td>
                </tr>
              ))}
              {data.feed.length === 0 && <tr><td colSpan={5} className="muted">No leads yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, delta, note, small }: { label: string; value: string; delta?: ReactNode; note?: string; small?: boolean }) {
  return (
    <div className={`kpi ${small ? 'small' : ''}`}>
      <span className="klabel">{label}</span>
      <span className="kvalue">{value}{delta}</span>
      {note && <span className="knote">{note}</span>}
    </div>
  );
}

function SpendCard({ roi, master, onSaved }: { roi: Data['roi']; master: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [week, setWeek] = useState(roi.weekStart);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await postJson('/api/spend', { weekStart: week, amount: Number(amount) });
      setEditing(false);
      setAmount('');
      onSaved();
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`kpi small spend ${master ? 'master' : ''}`}>
      <span className="klabel">Ad spend {master && <b className="tag">Master edits</b>}</span>
      <span className="kvalue">{money(roi.spend)}</span>
      <span className="knote">Entered weekly by Sam · week of {dayLabel(roi.weekStart)}</span>
      {master && !editing && <button className="link-btn" onClick={() => { setWeek(roi.weekStart); setEditing(true); }}>Set weekly spend</button>}
      {master && editing && (
        <form onSubmit={save} className="spend-form">
          <label>Week starting<input type="date" value={week} onChange={(e) => setWeek(e.target.value)} required /></label>
          <label>Amount ($)<input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
          {err && <span className="err">{err}</span>}
          <span className="row">
            <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save spend'}</button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
          </span>
        </form>
      )}
    </div>
  );
}
