// Browser-safe settings: labels, branding, tab layouts. No secrets, no env access.
import type { StageId } from '@/lib/types';

export const branding = {
  name: 'Outreach Hiring',
  subtitle: 'Recruiting command center',
  campaign: 'Recruiting campaign',
};

/** Exact stage labels used across the dashboard (spec table, stages 1-16). */
export const STAGE_LABELS: Record<StageId, string> = {
  leads: 'Leads',
  abandoned: 'Abandoned quiz',
  disqualified: 'Disqualified',
  passed: 'Passed quiz',
  passedNoInterview: 'Passed, no interview',
  booked1: '1st interview booked',
  showed1: '1st interview showed',
  noshow1: '1st interview no-show',
  rejected1: '1st interview rejected',
  booked2: '2nd interview booked',
  showed2: '2nd interview showed',
  noshow2: '2nd interview no-show',
  rejected2: '2nd interview rejected',
  pending2: '2nd interview pending',
  assigned: 'Assigned',
  hired: 'Hired',
};

/** Order of rows in the funnel card. */
export const FUNNEL_ORDER: StageId[] = [
  'leads', 'abandoned', 'disqualified', 'passed', 'passedNoInterview',
  'booked1', 'showed1', 'noshow1', 'rejected1',
  'booked2', 'showed2', 'noshow2', 'rejected2', 'pending2',
  'assigned', 'hired',
];

/** Columns of the weekly breakdown table (same layout as the Stats v2 tab). */
export const WEEKLY_COLUMNS: { stage: StageId; label: string }[] = [
  { stage: 'leads', label: 'Leads' },
  { stage: 'abandoned', label: 'Abandoned' },
  { stage: 'disqualified', label: 'Disqualified' },
  { stage: 'passed', label: 'Passed' },
  { stage: 'passedNoInterview', label: 'Passed, no interview' },
  { stage: 'booked1', label: '1st booked' },
  { stage: 'showed1', label: '1st showed' },
  { stage: 'rejected1', label: '1st rejected' },
  { stage: 'booked2', label: '2nd booked' },
  { stage: 'showed2', label: '2nd showed' },
  { stage: 'rejected2', label: '2nd rejected' },
  { stage: 'pending2', label: 'Pending' },
  { stage: 'assigned', label: 'Assigned' },
  { stage: 'hired', label: 'Hired' },
];

/** Stage tabs on the Leads page. A lead is in a tab when it has any of these stage events in the date range. */
export const LEAD_TABS: { id: string; label: string; stages: StageId[] }[] = [
  { id: 'leads', label: 'All', stages: ['leads'] },
  { id: 'abandoned', label: 'Abandoned', stages: ['abandoned'] },
  { id: 'disqualified', label: 'Disqualified', stages: ['disqualified'] },
  { id: 'passed', label: 'Passed', stages: ['passed'] },
  { id: 'booked1', label: '1st booked', stages: ['booked1'] },
  { id: 'showed1', label: 'Showed', stages: ['showed1'] },
  { id: 'noshow', label: 'No-show', stages: ['noshow1', 'noshow2'] },
  { id: 'booked2', label: '2nd interview', stages: ['booked2'] },
  { id: 'assigned', label: 'Assigned', stages: ['assigned'] },
  { id: 'hired', label: 'Hired', stages: ['hired'] },
];

/** "Furthest stage reached" ranking, used for the lead's current stage. */
export const STAGE_RANK: Record<StageId, number> = {
  leads: 10,
  abandoned: 20,
  disqualified: 20,
  passedNoInterview: 30,
  passed: 30,
  booked1: 40,
  noshow1: 45,
  showed1: 50,
  rejected1: 55,
  booked2: 60,
  noshow2: 65,
  showed2: 70,
  pending2: 72,
  rejected2: 75,
  assigned: 90,
  hired: 100,
};

export type Tone = 'gray' | 'blue' | 'amber' | 'red' | 'green' | 'navy' | 'orange';

/** Label + colour of the pill shown for a lead's current stage. */
export const CURRENT_STAGE: Record<StageId, { label: string; tone: Tone }> = {
  leads: { label: 'New lead', tone: 'gray' },
  abandoned: { label: 'Abandoned', tone: 'gray' },
  disqualified: { label: 'Quiz DQ', tone: 'gray' },
  passed: { label: 'Quiz passed', tone: 'blue' },
  passedNoInterview: { label: 'Quiz passed', tone: 'blue' },
  booked1: { label: 'Interview booked', tone: 'orange' },
  noshow1: { label: 'No-show', tone: 'red' },
  showed1: { label: 'Showed', tone: 'amber' },
  rejected1: { label: 'Rejected', tone: 'red' },
  booked2: { label: '2nd interview booked', tone: 'orange' },
  noshow2: { label: '2nd no-show', tone: 'red' },
  showed2: { label: '2nd interview', tone: 'amber' },
  pending2: { label: '2nd interview', tone: 'amber' },
  rejected2: { label: 'Rejected', tone: 'red' },
  assigned: { label: 'Assigned', tone: 'green' },
  hired: { label: 'Hired', tone: 'navy' },
};
