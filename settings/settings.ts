// SERVER-SIDE settings. Everything that may need to change without a code change lives here:
// sheet tabs, column names, dispo values, managers, test-lead patterns, auth env var NAMES.
// Secrets themselves are never stored here; only the names of the Vercel env vars that hold them.
//
// !! The tab and column names below are best guesses from the spec. On day 1, open the real
// !! sheet and make each name match the header text exactly (aliases are allowed: list several).
import type { RecordKind } from '@/lib/types';
export * from './public';

export const settings = {
  timezone: 'America/Los_Angeles',
  refreshSeconds: 120,

  /** Used when a typed date like 3/4/2025 could be either order. Day-first is what the sheet uses. */
  ambiguousDateOrder: 'DMY' as 'DMY' | 'MDY',

  env: {
    sheetId: 'GOOGLE_SHEET_ID',
    serviceAccountEmail: 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    privateKey: 'GOOGLE_PRIVATE_KEY',
    masterPassword: 'MASTER_PASSWORD',
    viewerPassword: 'VIEWER_PASSWORD',
    sessionSecret: 'SESSION_SECRET',
    dataSource: 'DATA_SOURCE',
    mysqlUrl: 'MYSQL_URL',
    mysqlHost: 'MYSQL_HOST',
    mysqlPort: 'MYSQL_PORT',
    mysqlUser: 'MYSQL_USER',
    mysqlPassword: 'MYSQL_PASSWORD',
    mysqlDatabase: 'MYSQL_DATABASE',
    mysqlSsl: 'MYSQL_SSL',
  },

  /** MySQL table names (see sql/schema.sql). */
  mysql: { tables: { records: 'lead_records', assignments: 'assignments', spend: 'spend' } },

  session: { cookie: 'oh_session', hours: 24 * 7, masterDisplayName: 'Sam' },

  /** Sales managers (the Assign dropdown). */
  managers: ['Manager A', 'Manager B', 'Manager C', 'Manager D'],

  /** Test leads: matched against name and email. */
  testLeads: {
    namePatterns: [/\btest\b/i, /\btester\b/i],
    emailPatterns: [/test/i],
    emails: ['test@test.test'],
  },

  /** Exact Dispo values interviewers pick on the Decision form. Compared case-insensitively. */
  dispo: {
    held1: 'Held 1st interview',
    rejected: 'Rejected',
    noShow: 'No show',
    unresponsive: 'Unresponsive',
    held2: 'Held 2nd interview - undetermined outcome',
    hired: 'Hired',
  },

  /**
   * "No show" entered by these people is a 2nd-interview no-show (confirmed by Sam).
   * Compared case-insensitively as a substring of the "Dispoed by" cell.
   */
  secondRoundNoShowBy: ['sam'],

  /** A dispo is 2nd round only if the 2nd interview was booked on an earlier day. */
  round2RequiresEarlierDay: true,

  /** Hired-list status values that mean the person did not stay (used for "active at 30 days"). */
  inactiveStatuses: ['terminated', 'quit', 'inactive', 'fired', 'left', 'dropped'],

  /** Markers written into the Assignments tab so a master can hide a lead without a new tab. */
  hideMarkers: { hide: '(hidden)', unhide: '(unhidden)' },

  sheet: {
    /** Shared identity columns; each entry is a list of accepted header names. */
    common: {
      name: ['Name', 'Full name', 'Contact name'],
      firstName: ['First name', 'First Name'],
      lastName: ['Last name', 'Last Name'],
      email: ['Email', 'Email address'],
      phone: ['Phone', 'Phone number'],
      created: ['Date of creation', 'Date created', 'Created'],
    },

    /** One entry per source tab. `action` = the column holding the date the action happened. */
    tabs: [
      {
        kind: 'lead',
        tab: 'All leads new',
        action: [],
        extra: { source: ['Source'], market: ['Market', 'City'], vsl: ['VSL watched', 'VSL %'] },
      },
      {
        kind: 'abandoned',
        tab: 'Abandoned quiz leads',
        action: ['Action date'],
        extra: { step: ['Abandoned at'], source: ['Source'], market: ['Market', 'City'], vsl: ['VSL watched', 'VSL %'] },
      },
      {
        kind: 'disqualified',
        tab: 'Disqualified leads',
        action: ['Action date'],
        quiz: true,
        extra: { step: ['Disqualified at', 'Failed at step'], source: ['Source'], market: ['Market', 'City'], vsl: ['VSL watched', 'VSL %'] },
      },
      {
        kind: 'passed',
        tab: 'Completed and passed quiz leads',
        action: ['Action date'],
        quiz: true,
        extra: { source: ['Source'], market: ['Market', 'City'], vsl: ['VSL watched', 'VSL %'] },
      },
      { kind: 'passedNoInterview', tab: 'Passed quiz with no 1st interview booked', action: ['Action date'], extra: {} },
      { kind: 'booked1', tab: '1st appointments booked', action: ['Date of Action', 'Action date'], extra: {} },
      { kind: 'booked2', tab: '2nd appointments booked', action: ['Date of action', 'Date of Action'], extra: {} },
      {
        kind: 'dispo',
        tab: 'Dispoed Appt Manually',
        action: ['Date of action', 'Date of Action'],
        extra: { outcome: ['Dispo', 'Dispo outcome'], by: ['Dispoed by'] },
      },
      { kind: 'autoNoShow', tab: 'Auto dispo new (no show)', action: ['Date of action', 'Date of Action'], extra: {} },
      {
        kind: 'hiredList',
        tab: 'Hired US list',
        action: ['Action date', 'Date of action'],
        extra: { status: ['Status'] },
      },
    ] as {
      kind: RecordKind;
      tab: string;
      action: string[];
      quiz?: boolean;
      extra: Partial<Record<'source' | 'market' | 'vsl' | 'step' | 'outcome' | 'by' | 'status', string[]>>;
    }[],

    /** Quiz questions in order. `column` = header(s) holding the raw answer on the quiz tabs. */
    quizQuestions: [
      { label: 'Sales experience', column: ['Sales experience', 'Q1'] },
      { label: 'Income ambition', column: ['Income ambition', 'Q2'] },
      { label: 'Primary motivation', column: ['Primary motivation', 'Q3'] },
      { label: 'Current monthly income', column: ['Current monthly income', 'Q4'] },
      { label: 'Financial readiness (90 days)', column: ['Financial readiness (90 days)', 'Financial readiness', 'Q5'] },
      { label: 'Weekly time commitment', column: ['Weekly time commitment', 'Q6'] },
      { label: 'Transportation', column: ['Transportation', 'Q7'] },
      { label: 'Rejection tolerance', column: ['Rejection tolerance', 'Q8'] },
      { label: 'Preferred work environment', column: ['Preferred work environment', 'Q9'] },
      { label: 'Interview commitment', column: ['Interview commitment', 'Q10'] },
    ],

    /** The two tabs the dashboard writes to (create them empty; headers are added automatically). */
    assignments: {
      tab: 'Assignments',
      columns: { name: 'Name', email: 'Email', phone: 'Phone', manager: 'Manager', date: 'Date', by: 'Assigned by' },
    },
    spend: {
      tab: 'Spend',
      columns: { week: 'Week starting', amount: 'Amount', by: 'Entered by', at: 'Entered at' },
    },
  },
};

export type Settings = typeof settings;

export function env(name: keyof typeof settings.env): string {
  return process.env[settings.env[name]] ?? '';
}
