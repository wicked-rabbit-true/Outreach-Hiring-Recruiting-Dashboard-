// Cleaning + counting model. Input: a Snapshot (source-agnostic). Output: one Person per human,
// with the date of every pipeline stage they reached. All the Stats v2 counting rules live here.
import type { AssignmentRecord, Dt, SourceRecord, SpendRecord, StageId, Snapshot } from '@/lib/types';
import { settings, STAGE_RANK } from '@/settings/settings';

export interface QuizState {
  status: 'passed' | 'failed' | 'abandoned' | 'none';
  step: number | null;
  answers: Record<string, string>;
}

export interface Person {
  id: string;
  name: string;
  email: string;
  phone: string;
  created: Dt | null;
  source: string;
  market: string;
  vsl: string;
  events: Partial<Record<StageId, Dt>>;
  dispos: { outcome: string; by: string; at: Dt | null }[];
  latestDispo: string;
  currentStage: StageId;
  manager: string;
  hidden: boolean;
  hiredStatus: string;
  quiz: QuizState;
  newestTs: number;
}

export interface ModelAssignment {
  personId: string;
  name: string;
  manager: string;
  at: Dt | null;
  by: string;
}

export interface Model {
  people: Person[]; // test leads already removed; hidden ones flagged
  assignments: ModelAssignment[]; // real assignments only
  spend: SpendRecord[];
  loadedAt: number;
  newestTs: number;
  warnings: string[];
  testExcluded: number;
}

// ---------- identity ----------

export function normPhone(p: string): string {
  const d = String(p ?? '').replace(/\D/g, '');
  if (d.length < 7) return '';
  return d.length > 10 ? d.slice(-10) : d;
}

function keysOf(id: { name: string; email: string; phone: string }): string[] {
  const k: string[] = [];
  if (id.email) k.push('e:' + id.email.toLowerCase().trim());
  const ph = normPhone(id.phone);
  if (ph) k.push('p:' + ph);
  if (!k.length && id.name) k.push('n:' + id.name.toLowerCase().replace(/\s+/g, ' ').trim());
  return k;
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    let c = x;
    while (c !== r) {
      const n = this.parent.get(c)!;
      this.parent.set(c, r);
      c = n;
    }
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (ra < rb) this.parent.set(rb, ra);
    else this.parent.set(ra, rb);
  }
}

function hashId(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

export function isTestLead(name: string, email: string): boolean {
  const t = settings.testLeads;
  if (email && t.emails.includes(email.toLowerCase())) return true;
  if (name && t.namePatterns.some((r) => r.test(name))) return true;
  if (email && t.emailPatterns.some((r) => r.test(email))) return true;
  return false;
}

// ---------- quiz ----------

const Q = settings.sheet.quizQuestions;

export function quizResults(q: QuizState): { label: string; result: 'pass' | 'fail' | 'unanswered' }[] {
  return Q.map((question, i) => {
    const n = i + 1;
    if (q.status === 'passed') return { label: question.label, result: 'pass' as const };
    if ((q.status === 'failed' || q.status === 'abandoned') && q.step) {
      if (n < q.step) return { label: question.label, result: 'pass' as const };
      if (n === q.step && q.status === 'failed') return { label: question.label, result: 'fail' as const };
    }
    return { label: question.label, result: 'unanswered' as const };
  });
}

export function quizSummary(q: QuizState): string {
  if (q.status === 'passed') return 'Passed';
  if (q.status === 'failed') {
    const label = q.step ? Q[q.step - 1]?.label : '';
    return label ? `Failed: ${label.toLowerCase()}` : 'Failed';
  }
  if (q.status === 'abandoned') return q.step ? `Left at Step ${q.step}` : 'Abandoned';
  return '—';
}

// ---------- build ----------

const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function buildModel(snap: Snapshot): Model {
  const uf = new UnionFind();
  const rowKey = new Map<object, string>();
  let anon = 0;

  const register = (obj: object, id: { name: string; email: string; phone: string }) => {
    const ks = keysOf(id);
    if (!ks.length) ks.push('x:' + anon++);
    for (let i = 1; i < ks.length; i++) uf.union(ks[0], ks[i]);
    uf.find(ks[0]);
    rowKey.set(obj, ks[0]);
  };
  for (const r of snap.records) register(r, r.id);
  for (const a of snap.assignments) register(a, a.id);

  const groups = new Map<string, { recs: SourceRecord[]; assigns: AssignmentRecord[] }>();
  const grp = (root: string) => {
    let g = groups.get(root);
    if (!g) groups.set(root, (g = { recs: [], assigns: [] }));
    return g;
  };
  for (const r of snap.records) grp(uf.find(rowKey.get(r)!)).recs.push(r);
  for (const a of snap.assignments) grp(uf.find(rowKey.get(a)!)).assigns.push(a);

  const people: Person[] = [];
  const assignments: ModelAssignment[] = [];
  let newestTs = 0;
  let testExcluded = 0;
  const { hide, unhide } = settings.hideMarkers;

  for (const [root, g] of groups) {
    const name = g.recs.find((r) => r.kind === 'lead' && r.id.name)?.id.name ||
      g.recs.find((r) => r.id.name)?.id.name || g.assigns.find((a) => a.id.name)?.id.name || '';
    const email = g.recs.find((r) => r.id.email)?.id.email || g.assigns.find((a) => a.id.email)?.id.email || '';
    const phone = g.recs.find((r) => r.id.phone)?.id.phone || g.assigns.find((a) => a.id.phone)?.id.phone || '';

    if (g.recs.some((r) => isTestLead(r.id.name, r.id.email)) || isTestLead(name, email)) {
      testExcluded++;
      continue;
    }

    // creation date: the lead row, else the earliest creation seen, else the earliest action.
    const leadRec = g.recs.find((r) => r.kind === 'lead' && (r.created ?? r.at));
    let created: Dt | null = leadRec ? (leadRec.created ?? leadRec.at) : null;
    if (!created) {
      for (const r of g.recs) {
        const c = r.created;
        if (c && (!created || c.ts < created.ts)) created = c;
      }
    }
    if (!created) {
      for (const r of g.recs) if (r.at && (!created || r.at.ts < created.ts)) created = r.at;
    }

    const events: Partial<Record<StageId, Dt>> = {};
    const add = (stage: StageId, dt: Dt | null) => {
      if (!dt) return;
      const cur = events[stage];
      if (!cur || dt.ts < cur.ts) events[stage] = dt;
    };
    const when = (r: SourceRecord) => r.at ?? created; // blank action date -> creation date

    const dispos: Person['dispos'] = [];
    let newestPerson = 0;
    let hiredStatus = '';
    const answers: Record<string, string> = {};
    let step: number | null = null;
    let source = '';
    let market = '';
    let vsl = '';

    for (const r of g.recs) {
      const w = when(r);
      newestPerson = Math.max(newestPerson, r.at?.ts ?? 0, r.created?.ts ?? 0);
      source ||= r.meta.source ?? '';
      market ||= r.meta.market ?? '';
      vsl ||= r.meta.vsl ?? '';
      if (r.answers) for (const [k, v] of Object.entries(r.answers)) if (v && !answers[k]) answers[k] = v;
      switch (r.kind) {
        case 'lead': add('leads', r.created ?? r.at ?? created); break;
        case 'abandoned': add('abandoned', w); if (r.meta.step) step = step ?? r.meta.step; break;
        case 'disqualified': add('disqualified', w); if (r.meta.step) step = r.meta.step; break;
        case 'passed': add('passed', w); break;
        case 'passedNoInterview': add('passedNoInterview', w); break;
        case 'booked1': add('booked1', w); break;
        case 'booked2': add('booked2', w); break;
        case 'hiredList': add('hired', w); hiredStatus = r.meta.status ?? hiredStatus; break;
        case 'dispo': dispos.push({ outcome: r.meta.outcome ?? '', by: r.meta.by ?? '', at: w }); break;
        case 'autoNoShow': dispos.push({ outcome: settings.dispo.noShow, by: '', at: w }); break;
      }
    }
    // Every person is a lead, even if only found in a later-stage tab.
    if (!events.leads && created) add('leads', created);

    // ---- interview outcomes: round decided by the lead's own history ----
    dispos.sort((a, b) => (a.at?.ts ?? 0) - (b.at?.ts ?? 0));
    const booked2 = events.booked2;
    const D = settings.dispo;
    for (const d of dispos) {
      if (!d.at) continue;
      const round2 = !!booked2 && (settings.round2RequiresEarlierDay ? booked2.day < d.at.day : booked2.day <= d.at.day);
      const o = d.outcome;
      if (eq(o, D.held1)) add('showed1', d.at);
      else if (eq(o, D.held2)) add('showed2', d.at);
      else if (eq(o, D.hired)) { add('hired', d.at); add('showed2', d.at); }
      else if (eq(o, D.rejected)) {
        if (round2) { add('rejected2', d.at); add('showed2', d.at); } else add('rejected1', d.at);
      } else if (eq(o, D.noShow)) {
        const bySecond = settings.secondRoundNoShowBy.some((s) => d.by.toLowerCase().includes(s));
        add(bySecond || round2 ? 'noshow2' : 'noshow1', d.at);
      } else if (eq(o, D.unresponsive)) add(round2 ? 'noshow2' : 'noshow1', d.at);
    }
    const last = dispos[dispos.length - 1];
    if (last?.at && eq(last.outcome, D.held2) && !events.hired && !events.rejected2) add('pending2', last.at);

    // ---- assignments ----
    const sorted = [...g.assigns].sort((a, b) => (a.at?.ts ?? 0) - (b.at?.ts ?? 0));
    let hidden = false;
    let manager = '';
    const personId = hashId(root);
    for (const a of sorted) {
      if (a.manager === hide) hidden = true;
      else if (a.manager === unhide) hidden = false;
      else {
        manager = a.manager;
        add('assigned', a.at ?? created);
        assignments.push({ personId, name: a.id.name || name, manager: a.manager, at: a.at, by: a.by });
        newestPerson = Math.max(newestPerson, a.at?.ts ?? 0);
      }
    }

    // ---- current stage = furthest reached ----
    let currentStage: StageId = 'leads';
    let best = -1;
    for (const [s, dt] of Object.entries(events) as [StageId, Dt][]) {
      const rank = STAGE_RANK[s] * 1e13 + dt.ts / 1e3;
      if (rank > best) { best = rank; currentStage = s; }
    }

    const status: QuizState['status'] = events.passed ? 'passed' : events.disqualified ? 'failed' : events.abandoned ? 'abandoned' : 'none';
    const lastDispo = dispos.length ? dispos[dispos.length - 1].outcome : '';

    newestTs = Math.max(newestTs, newestPerson);
    people.push({
      id: personId, name, email, phone, created, source, market, vsl,
      events, dispos, latestDispo: lastDispo, currentStage, manager, hidden, hiredStatus,
      quiz: { status, step, answers }, newestTs: newestPerson,
    });
  }

  assignments.sort((a, b) => (b.at?.ts ?? 0) - (a.at?.ts ?? 0));
  return { people, assignments, spend: snap.spend, loadedAt: snap.loadedAt, newestTs, warnings: snap.warnings, testExcluded };
}
