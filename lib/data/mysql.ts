// MySQL implementation of DataSource. Same interface as the Google Sheets source, so nothing else changes.
// Schema: sql/schema.sql. Select it with DATA_SOURCE=mysql.
import mysql, { type Pool, type PoolOptions, type RowDataPacket } from 'mysql2/promise';
import { parseDate } from '@/lib/dates';
import type { AssignmentRecord, DataSource, Identity, RecordKind, Snapshot, SourceRecord, SpendRecord } from '@/lib/types';
import { env, settings } from '@/settings/settings';

const KINDS = new Set<RecordKind>(['lead', 'abandoned', 'disqualified', 'passed', 'passedNoInterview', 'booked1', 'booked2', 'hiredList', 'dispo', 'autoNoShow']);

/** Table names come from settings; refuse anything that is not a plain identifier. */
function table(name: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Invalid table name: ${name}`);
  return `\`${name}\``;
}

export function connectionOptions(): PoolOptions {
  const url = env('mysqlUrl');
  const ssl = env('mysqlSsl') === 'true' ? { rejectUnauthorized: true } : undefined;
  const base: PoolOptions = url
    ? { uri: url }
    : {
        host: env('mysqlHost'),
        port: Number(env('mysqlPort')) || 3306,
        user: env('mysqlUser'),
        password: env('mysqlPassword'),
        database: env('mysqlDatabase'),
      };
  if (!url && (!base.host || !base.user || !base.database)) {
    throw new Error('MySQL is not configured: set MYSQL_URL, or MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE');
  }
  // timezone 'Z' = DATETIME columns are read and written as UTC.
  return { ...base, ssl, timezone: 'Z', charset: 'utf8mb4' };
}

const g = globalThis as unknown as { __ohPool?: Pool };

export function getPool(): Pool {
  return (g.__ohPool ??= mysql.createPool({ ...connectionOptions(), waitForConnections: true, connectionLimit: 5 }));
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const dt = (v: unknown) => (v ? parseDate(v instanceof Date ? v.toISOString() : String(v)) : null);

function parseAnswers(v: unknown): Record<string, string> | undefined {
  if (!v) return undefined;
  let o: unknown = v;
  if (typeof v === 'string') {
    try { o = JSON.parse(v); } catch { return undefined; }
  }
  if (typeof o !== 'object' || o === null) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(o as Record<string, unknown>)) if (str(val)) out[k] = str(val);
  return out;
}

export class MysqlSource implements DataSource {
  async load(): Promise<Snapshot> {
    const p = getPool();
    const t = settings.mysql.tables;
    const warnings: string[] = [];

    const [lr] = await p.query<RowDataPacket[]>(`SELECT * FROM ${table(t.records)}`);
    const records: SourceRecord[] = [];
    for (const r of lr) {
      const kind = str(r.kind) as RecordKind;
      if (!KINDS.has(kind)) {
        warnings.push(`Skipped a row with unknown kind "${kind}".`);
        continue;
      }
      const id: Identity = { name: str(r.name), email: str(r.email).toLowerCase(), phone: str(r.phone) };
      if (!id.name && !id.email && !id.phone) continue;
      const created = dt(r.created_at);
      const at = dt(r.action_at);
      const rec: SourceRecord = {
        kind,
        id,
        at: kind === 'lead' ? at ?? created : at,
        created,
        meta: {
          source: str(r.source),
          market: str(r.market),
          vsl: str(r.vsl),
          outcome: str(r.outcome),
          by: str(r.dispoed_by),
          status: str(r.status),
          step: r.step === null || r.step === undefined ? undefined : Number(r.step),
        },
      };
      const answers = parseAnswers(r.answers);
      if (answers) rec.answers = answers;
      records.push(rec);
    }

    const [ar] = await p.query<RowDataPacket[]>(`SELECT * FROM ${table(t.assignments)}`);
    const assignments: AssignmentRecord[] = ar
      .filter((r) => str(r.manager))
      .map((r) => ({
        id: { name: str(r.name), email: str(r.email).toLowerCase(), phone: str(r.phone) },
        manager: str(r.manager),
        at: dt(r.assigned_at),
        by: str(r.assigned_by),
      }));

    const [sr] = await p.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(week_start, '%Y-%m-%d') AS week_start, amount, entered_by FROM ${table(t.spend)}`,
    );
    const spend: SpendRecord[] = sr.map((r) => ({ weekStart: str(r.week_start), amount: Number(r.amount), by: str(r.entered_by) }));

    return { records, assignments, spend, loadedAt: Date.now(), warnings };
  }

  async addAssignment(a: { id: Identity; manager: string; by: string }): Promise<void> {
    await getPool().query(
      `INSERT INTO ${table(settings.mysql.tables.assignments)} (name, email, phone, manager, assigned_at, assigned_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [a.id.name, a.id.email, a.id.phone, a.manager, new Date(), a.by],
    );
  }

  /** One amount per week: the week is the primary key, so saving again updates it. */
  async setSpend(weekStart: string, amount: number, by: string): Promise<void> {
    await getPool().query(
      `INSERT INTO ${table(settings.mysql.tables.spend)} (week_start, amount, entered_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount), entered_by = VALUES(entered_by), entered_at = CURRENT_TIMESTAMP`,
      [weekStart, amount, by],
    );
  }
}
