// Run with: npm run selftest. No network or sheet needed: feeds a synthetic Snapshot through the real engine.
import assert from 'node:assert/strict';
import { parseDate, weekStart } from '../lib/dates';
import { buildModel } from '../lib/engine/model';
import { countStage, leadDetail, managersView } from '../lib/engine/metrics';
import type { Identity, RecordKind, SourceRecord, Snapshot } from '../lib/types';

const d = (v: string) => parseDate(v)!;
const id = (name: string, email: string, phone = ''): Identity => ({ name, email, phone });
const rec = (kind: RecordKind, i: Identity, at: string | null, extra: Partial<SourceRecord> = {}): SourceRecord => ({
  kind, id: i, at: at ? d(at) : null, created: null, meta: {}, ...extra,
});

// ---- dates ----
assert.equal(parseDate('24/9/2025')!.day, '2025-09-24', 'day-first text');
assert.equal(parseDate('9/24/2025')!.day, '2025-09-24', 'month-first when unambiguous');
assert.equal(parseDate('2025-10-07')!.day, '2025-10-07', 'ISO');
assert.equal(parseDate(45937)!.day, '2025-10-07', 'Google serial');
assert.equal(parseDate('2025-10-08T02:30:00Z')!.day, '2025-10-07', 'UTC instant lands on the Pacific day before');
assert.equal(parseDate('')?.day, undefined);
assert.equal(weekStart('2025-10-07'), '2025-10-06', 'Monday start');
assert.equal(weekStart('2025-10-12'), '2025-10-06', 'Sunday belongs to the Monday week');

// ---- scenario ----
const ann = id('Ann Lead', 'ann@x.com', '(702) 555-0101');
const annAlt = id('Ann Lead', '', '702-555-0101'); // same person, matched by phone
const bob = id('Bob Rejected1', 'bob@x.com');
const cat = id('Cat Second', 'cat@x.com');
const dan = id('Dan Samnoshow', 'dan@x.com');
const eve = id('Eve Blank', 'eve@x.com');
const tst = id('Test Person', 'test@test.test');
const fay = id('Fay DQ', 'fay@x.com');

const records: SourceRecord[] = [
  rec('lead', ann, '2025-09-29'), rec('lead', bob, '2025-09-30'), rec('lead', cat, '2025-09-30'),
  rec('lead', dan, '2025-10-01'), rec('lead', eve, '2025-10-02'), rec('lead', tst, '2025-10-02'), rec('lead', fay, '2025-10-02'),
  rec('passed', ann, '2025-09-29'), rec('passed', ann, '2025-09-29'), // duplicate row
  rec('booked1', ann, '2025-09-30'),
  rec('dispo', annAlt, '2025-10-07', { meta: { outcome: 'Held 1st interview', by: 'Yume' } }),
  rec('dispo', bob, '2025-10-03', { meta: { outcome: 'Rejected', by: 'Moe' } }),
  rec('booked2', cat, '2025-10-01'),
  rec('dispo', cat, '2025-10-03', { meta: { outcome: 'Rejected', by: 'Yume' } }), // 2nd round: booked earlier
  rec('dispo', dan, '2025-10-08', { meta: { outcome: 'No show', by: 'Sam' } }),
  rec('passed', eve, null), // blank action date -> creation date
  rec('disqualified', fay, '2025-10-02', { meta: { step: 6 } }),
  rec('dispo', cat, '2025-10-04', { meta: { outcome: 'Held 2nd interview - undetermined outcome', by: 'Sam' } }),
];
const snap: Snapshot = { records, assignments: [], spend: [{ weekStart: '2025-09-29', amount: 1000 }], loadedAt: Date.now(), warnings: [] };
const m = buildModel(snap);

assert.equal(m.testExcluded, 1, 'test lead removed');
assert.equal(m.people.length, 6, 'one record per person');
const people = m.people;
const w1 = { from: '2025-09-29', to: '2025-10-05' };
const w2 = { from: '2025-10-06', to: '2025-10-12' };

assert.equal(countStage(people, 'leads', w1), 6, 'leads counted by creation date');
assert.equal(countStage(people, 'passed', w1), 2, 'duplicate passed rows count once (Ann + Eve fallback)');
assert.equal(countStage(people, 'showed1', w1), 0, 'a show on Oct 7 is NOT in the Sep 29 week');
assert.equal(countStage(people, 'showed1', w2), 1, 'Ann showed in the Oct 6 week (matched across email/phone)');
assert.equal(countStage(people, 'rejected1', w1), 1, 'Bob: rejected before any 2nd booking = 1st round');
assert.equal(countStage(people, 'rejected2', w1), 1, 'Cat: 2nd booked earlier => 2nd round');
assert.equal(countStage(people, 'showed2', w1), 1, 'Cat counts once as showed2 (earliest of her 2nd-round events)');
assert.equal(countStage(people, 'noshow2', w2), 1, 'No show entered by Sam = 2nd interview no-show');
assert.equal(countStage(people, 'noshow1', w2), 0);
assert.equal(countStage(people, 'disqualified', w1), 1);

const ann1 = people.find((p) => p.name === 'Ann Lead')!;
assert.equal(ann1.currentStage, 'showed1');
assert.equal(ann1.latestDispo, 'Held 1st interview');
const detail = leadDetail(m, people.find((p) => p.name === 'Fay DQ')!.id, false)!;
assert.ok(!detail.questions.some((q: Record<string, unknown>) => 'answer' in q), 'viewer detail has no raw answers');
assert.equal(detail.questions[5].result, 'fail', 'step 6 is the failed question');
assert.equal(detail.questions[0].result, 'pass');
assert.ok(managersView(m).table.length >= 4);

console.log('selftest: all checks passed');
