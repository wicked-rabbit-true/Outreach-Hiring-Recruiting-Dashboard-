// Domain types. Nothing in here knows about Google Sheets or GoHighLevel.
// A data source (lib/data/*) only has to produce a `Snapshot`.

export type Role = 'master' | 'viewer';

export type StageId =
  | 'leads'
  | 'abandoned'
  | 'disqualified'
  | 'passed'
  | 'passedNoInterview'
  | 'booked1'
  | 'showed1'
  | 'noshow1'
  | 'rejected1'
  | 'booked2'
  | 'showed2'
  | 'noshow2'
  | 'rejected2'
  | 'pending2'
  | 'hired'
  | 'assigned';

/** A moment in time, already normalised to Pacific. `day` is YYYY-MM-DD in Pacific time. */
export interface Dt {
  day: string;
  ts: number;
}

export interface Identity {
  name: string;
  email: string; // lower-cased
  phone: string; // raw; normalised by the engine
}

export type RecordKind =
  | 'lead'
  | 'abandoned'
  | 'disqualified'
  | 'passed'
  | 'passedNoInterview'
  | 'booked1'
  | 'booked2'
  | 'hiredList'
  | 'dispo'
  | 'autoNoShow';

/** One cleaned row from any source tab / API object. */
export interface SourceRecord {
  kind: RecordKind;
  id: Identity;
  /** Date the action happened (may be null when blank in the source). */
  at: Dt | null;
  /** Lead creation date when the source carries it. */
  created: Dt | null;
  meta: {
    source?: string;
    market?: string;
    vsl?: string;
    /** Quiz step number (abandoned / disqualified). */
    step?: number | null;
    /** Dispo outcome text exactly as entered. */
    outcome?: string;
    by?: string;
    status?: string;
  };
  /** Raw quiz answers keyed by question label (only on quiz tabs). */
  answers?: Record<string, string>;
}

export interface AssignmentRecord {
  id: Identity;
  manager: string;
  at: Dt | null;
  by: string;
}

export interface SpendRecord {
  weekStart: string; // YYYY-MM-DD (a Monday)
  amount: number;
  by?: string;
}

export interface Snapshot {
  records: SourceRecord[];
  assignments: AssignmentRecord[];
  spend: SpendRecord[];
  loadedAt: number;
  warnings: string[];
}

/** The only thing the app needs from a backend. Implement this for GoHighLevel in V2. */
export interface DataSource {
  load(): Promise<Snapshot>;
  addAssignment(a: { id: Identity; manager: string; by: string }): Promise<void>;
  setSpend(weekStart: string, amount: number, by: string): Promise<void>;
}
