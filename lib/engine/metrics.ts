// Every number shown in the UI is computed here, on the server, from the Model.
import { addDays, todayKey, weekEnd, weekStart } from '@/lib/dates';
import type { StageId } from '@/lib/types';
import { CURRENT_STAGE, FUNNEL_ORDER, LEAD_TABS, STAGE_LABELS, WEEKLY_COLUMNS, settings } from '@/settings/settings';
import type { Model, Person } from './model';
import { quizResults, quizSummary } from './model';
import { inRange, type Range } from './range';

const active = (m: Model) => m.people.filter((p) => !p.hidden);
const stageDay = (p: Person, s: StageId) => p.events[s]?.day;

export function countStage(people: Person[], stage: StageId, r: Range): number {
  let n = 0;
  for (const p of people) if (inRange(stageDay(p, stage), r)) n++;
  return n;
}

const rate = (num: number, den: number): number | null => (den > 0 ? (num / den) * 100 : null);
const div = (num: number, den: number): number | null => (den > 0 ? num / den : null);

function spendBetween(m: Model, fromWeek: string, toWeek: string): number {
  let s = 0;
  for (const x of m.spend) if (x.weekStart >= fromWeek && x.weekStart <= toWeek) s += x.amount;
  return s;
}

function kpiSet(people: Person[], r: Range) {
  const c = (s: StageId) => countStage(people, s, r);
  const passed = c('passed');
  const dq = c('disqualified');
  const showed = c('showed1');
  const noShow = c('noshow1');
  return {
    newLeads: c('leads'),
    quizPassRate: rate(passed, passed + dq),
    passed,
    completed: passed + dq,
    interviewsBooked: c('booked1'),
    showRate: rate(showed, showed + noShow),
    showed,
    noShow,
    assigned: c('assigned'),
    hires: c('hired'),
  };
}

export function dashboard(m: Model, range: Range, prev: Range) {
  const people = active(m);
  const cur = kpiSet(people, range);
  const old = kpiSet(people, prev);

  // ROI: week-aligned. Cost per lead / quiz-passer use the selected week(s); cost per show / hire use the last 4 weeks.
  const wFrom = weekStart(range.from);
  const wTo = weekStart(range.to);
  const weeksRange: Range = { from: wFrom, to: weekEnd(range.to) };
  const spend = spendBetween(m, wFrom, wTo);
  const leadsW = countStage(people, 'leads', weeksRange);
  const passedW = countStage(people, 'passed', weeksRange);
  const start4 = addDays(wTo, -21);
  const r4: Range = { from: start4, to: weekEnd(range.to) };
  const spend4 = spendBetween(m, start4, wTo);
  const shows4 = countStage(people, 'showed1', r4);
  const hires4 = countStage(people, 'hired', r4);

  const leads = cur.newLeads;
  const funnel = FUNNEL_ORDER.map((stage) => {
    const count = countStage(people, stage, range);
    return { stage, label: STAGE_LABELS[stage], count, pct: rate(count, leads) };
  });

  // Quiz card
  const dqPeople = people.filter((p) => inRange(stageDay(p, 'disqualified'), range));
  const byStep = new Map<number, number>();
  for (const p of dqPeople) if (p.quiz.step) byStep.set(p.quiz.step, (byStep.get(p.quiz.step) ?? 0) + 1);
  const reasons = [...byStep.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([step, count]) => ({
      step,
      label: settings.sheet.quizQuestions[step - 1]?.label ?? `Step ${step}`,
      count,
      pct: rate(count, dqPeople.length),
    }));

  return {
    range,
    prev,
    kpis: { current: cur, previous: old },
    roi: {
      spend,
      weekStart: wFrom,
      costPerLead: div(spend, leadsW),
      costPerPasser: div(spend, passedW),
      costPerShow: div(spend4, shows4),
      costPerHire: div(spend4, hires4),
      last4: { from: r4.from, to: r4.to, spend: spend4, shows: shows4, hires: hires4 },
    },
    funnel,
    quiz: {
      completionRate: rate(cur.completed, leads),
      passRate: cur.quizPassRate,
      completed: cur.completed,
      passed: cur.passed,
      disqualified: dqPeople.length,
      reasons,
    },
    feed: feed(people),
    lastUpdated: m.newestTs || m.loadedAt,
    loadedAt: m.loadedAt,
    warnings: m.warnings,
  };
}

export function weekly(m: Model, weeks = 8, now = Date.now()) {
  const people = active(m);
  const thisWeek = weekStart(todayKey(now));
  const rows = [];
  const totals: Record<string, number> = {};
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i);
    const r = { from: ws, to: weekEnd(ws) };
    const counts: Record<string, number> = {};
    for (const col of WEEKLY_COLUMNS) {
      counts[col.stage] = countStage(people, col.stage, r);
      totals[col.stage] = (totals[col.stage] ?? 0) + counts[col.stage];
    }
    rows.push({ weekStart: ws, weekEnd: r.to, counts });
  }
  return { columns: WEEKLY_COLUMNS, rows, totals };
}

function feed(people: Person[]) {
  return [...people]
    .filter((p) => p.created)
    .sort((a, b) => b.created!.ts - a.created!.ts)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: p.name || '(no name)',
      stage: CURRENT_STAGE[p.currentStage].label,
      tone: CURRENT_STAGE[p.currentStage].tone,
      manager: p.manager,
      market: p.market,
      ts: p.created!.ts,
    }));
}

// ---------- Leads ----------

export interface LeadsQuery {
  stage: string;
  range: Range;
  q?: string;
  manager?: string;
  source?: string;
  showHidden?: boolean;
}

export function leadsList(m: Model, query: LeadsQuery) {
  const q = (query.q ?? '').trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const base = m.people.filter((p) => {
    if (!!p.hidden !== !!query.showHidden) return false;
    if (query.manager && (query.manager === '__none__' ? p.manager : p.manager !== query.manager)) return false;
    if (query.source && p.source !== query.source) return false;
    if (q) {
      const hay = `${p.name} ${p.email}`.toLowerCase();
      const phone = p.phone.replace(/\D/g, '');
      if (!hay.includes(q) && !(qDigits.length >= 3 && phone.includes(qDigits))) return false;
    }
    return true;
  });

  const tabs = LEAD_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    count: base.filter((p) => t.stages.some((s) => inRange(stageDay(p, s), query.range))).length,
  }));

  const tab = LEAD_TABS.find((t) => t.id === query.stage);
  const stages: StageId[] = tab ? tab.stages : query.stage in STAGE_LABELS ? [query.stage as StageId] : ['leads'];
  const activeLabel = tab ? tab.label : STAGE_LABELS[stages[0]];

  const matches = base
    .filter((p) => stages.some((s) => inRange(stageDay(p, s), query.range)))
    .sort((a, b) => (b.created?.ts ?? 0) - (a.created?.ts ?? 0));

  const rows = matches.slice(0, 500).map((p) => ({
    id: p.id,
    name: p.name || '(no name)',
    email: p.email,
    phone: p.phone,
    stage: CURRENT_STAGE[p.currentStage].label,
    tone: CURRENT_STAGE[p.currentStage].tone,
    latestDispo: p.latestDispo,
    quiz: quizSummary(p.quiz),
    manager: p.manager,
    source: p.source,
    market: p.market,
    received: p.created?.ts ?? 0,
  }));

  return {
    tabs,
    active: tab ? tab.id : query.stage,
    activeLabel,
    total: matches.length,
    rows,
    managers: [...new Set(m.people.map((p) => p.manager).filter(Boolean))].sort(),
    sources: [...new Set(m.people.map((p) => p.source).filter(Boolean))].sort(),
    hiddenCount: m.people.filter((p) => p.hidden).length,
    lastUpdated: m.newestTs || m.loadedAt,
  };
}

/** Detail panel. `answers` is only filled when `includeRaw` (master) is true. */
export function leadDetail(m: Model, id: string, includeRaw: boolean) {
  const p = m.people.find((x) => x.id === id);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name || '(no name)',
    stage: CURRENT_STAGE[p.currentStage].label,
    tone: CURRENT_STAGE[p.currentStage].tone,
    source: p.source,
    market: p.market,
    vsl: p.vsl,
    latestDispo: p.latestDispo,
    manager: p.manager,
    hidden: p.hidden,
    quizStatus: p.quiz.status,
    quizSummary: quizSummary(p.quiz),
    questions: quizResults(p.quiz).map((r, i) => ({
      ...r,
      ...(includeRaw ? { answer: p.quiz.answers[settings.sheet.quizQuestions[i].label] ?? '' } : {}),
    })),
  };
}

// ---------- Managers ----------

export function managersView(m: Model, now = Date.now()) {
  const today = todayKey(now);
  const from = addDays(today, -89);
  const byId = new Map(m.people.map((p) => [p.id, p]));
  const recent = m.assignments.filter((a) => a.at && a.at.day >= from && a.at.day <= today);
  const names = [...new Set([...settings.managers, ...recent.map((a) => a.manager)])];
  const cutoff = addDays(today, -30);

  const table = names.map((manager) => {
    const ids = new Set(recent.filter((a) => a.manager === manager).map((a) => a.personId));
    const recruits = [...ids].map((id) => byId.get(id)).filter((p): p is Person => !!p && !p.hidden);
    const started = recruits.filter((p) => p.events.hired);
    const eligible = started.filter((p) => p.events.hired!.day <= cutoff);
    const stillActive = eligible.filter((p) => !settings.inactiveStatuses.includes(p.hiredStatus.toLowerCase()));
    return {
      manager,
      assigned: recruits.length,
      started: started.length,
      activeAt30: eligible.length ? Math.round((stillActive.length / eligible.length) * 100) : null,
      startRate: recruits.length ? Math.round((started.length / recruits.length) * 100) : null,
    };
  });

  const ready = active(m)
    .filter((p) => (p.events.showed1 || p.events.showed2) && !p.manager)
    .map((p) => ({ p, at: (p.events.showed2 ?? p.events.showed1)!.ts }))
    .sort((a, b) => b.at - a.at)
    .slice(0, 50)
    .map(({ p, at }) => ({ id: p.id, name: p.name || '(no name)', market: p.market, showedAt: at }));

  const log = m.assignments.slice(0, 100).map((a) => ({
    personId: a.personId,
    name: byId.get(a.personId)?.name || a.name,
    manager: a.manager,
    ts: a.at?.ts ?? 0,
    by: a.by,
  }));

  return { table, ready, log, managers: settings.managers, windowFrom: from, windowTo: today };
}
