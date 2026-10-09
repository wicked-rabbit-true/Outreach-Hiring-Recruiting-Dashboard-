// Google Sheets implementation of DataSource. This is the ONLY file that knows about the sheet layout.
// For V2, write lib/data/ghl.ts implementing the same interface and change lib/data/index.ts.
import { google, type sheets_v4 } from 'googleapis';
import { parseDate } from '@/lib/dates';
import type { AssignmentRecord, DataSource, Identity, SourceRecord, SpendRecord, Snapshot } from '@/lib/types';
import { env, settings } from '@/settings/settings';

type Cell = string | number | boolean | null | undefined;

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

class Table {
  private idx = new Map<string, number>();
  constructor(public headers: string[], public rows: Cell[][]) {
    headers.forEach((h, i) => {
      const k = norm(h);
      if (k && !this.idx.has(k)) this.idx.set(k, i);
    });
  }
  /** First non-empty value among the accepted header names. */
  get(row: Cell[], names: string[] | undefined): Cell {
    if (!names) return '';
    for (const n of names) {
      const i = this.idx.get(norm(n));
      if (i === undefined) continue;
      const v = row[i];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  }
  has(names: string[]) {
    return names.some((n) => this.idx.has(norm(n)));
  }
}

const str = (v: Cell) => (v === undefined || v === null ? '' : String(v).trim());

function parseStep(v: Cell): number | null {
  const m = str(v).match(/\d+/);
  return m ? +m[0] : null;
}

export class GoogleSheetsSource implements DataSource {
  private client: sheets_v4.Sheets | null = null;

  private sheets(): sheets_v4.Sheets {
    if (this.client) return this.client;
    const email = env('serviceAccountEmail');
    const key = env('privateKey').replace(/\\n/g, '\n');
    if (!email || !key) throw new Error('Google service account credentials are not configured');
    const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    this.client = google.sheets({ version: 'v4', auth });
    return this.client;
  }

  private sheetId(): string {
    const id = env('sheetId');
    if (!id) throw new Error('GOOGLE_SHEET_ID is not configured');
    return id;
  }

  async load(): Promise<Snapshot> {
    const api = this.sheets();
    const spreadsheetId = this.sheetId();
    const warnings: string[] = [];

    const meta = await api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const existing = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ''));

    const cfg = settings.sheet;
    const wanted: string[] = [];
    for (const t of cfg.tabs) {
      if (existing.has(t.tab)) wanted.push(t.tab);
      else warnings.push(`Tab "${t.tab}" was not found in the sheet.`);
    }
    for (const t of [cfg.assignments.tab, cfg.spend.tab]) {
      if (existing.has(t)) wanted.push(t);
      else warnings.push(`Tab "${t}" was not found in the sheet. Create it (empty).`);
    }

    const res = await api.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: wanted.map((t) => `'${t}'`),
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER',
    });
    const byTab = new Map<string, Table>();
    (res.data.valueRanges ?? []).forEach((vr, i) => {
      const values = (vr.values ?? []) as Cell[][];
      byTab.set(wanted[i], new Table((values[0] ?? []).map(str), values.slice(1)));
    });

    const order = settings.ambiguousDateOrder;
    const c = cfg.common;
    const records: SourceRecord[] = [];

    for (const t of cfg.tabs) {
      const table = byTab.get(t.tab);
      if (!table) continue;
      if (table.rows.length && !table.has(c.email) && !table.has(c.phone)) {
        warnings.push(`Tab "${t.tab}": no email or phone column found, so rows cannot be matched to people.`);
      }
      for (const row of table.rows) {
        if (!row || row.every((v) => str(v) === '')) continue;
        let name = str(table.get(row, c.name));
        if (!name) name = `${str(table.get(row, c.firstName))} ${str(table.get(row, c.lastName))}`.trim();
        const id: Identity = {
          name,
          email: str(table.get(row, c.email)).toLowerCase(),
          phone: str(table.get(row, c.phone)),
        };
        if (!id.name && !id.email && !id.phone) continue;

        const created = parseDate(table.get(row, c.created), order);
        const at = parseDate(table.get(row, t.action), order);
        const rec: SourceRecord = {
          kind: t.kind,
          id,
          at: t.kind === 'lead' ? at ?? created : at,
          created,
          meta: {
            source: str(table.get(row, t.extra.source)),
            market: str(table.get(row, t.extra.market)),
            vsl: str(table.get(row, t.extra.vsl)),
            outcome: str(table.get(row, t.extra.outcome)),
            by: str(table.get(row, t.extra.by)),
            status: str(table.get(row, t.extra.status)),
            step: t.extra.step ? parseStep(table.get(row, t.extra.step)) : undefined,
          },
        };
        if (t.quiz) {
          rec.answers = {};
          for (const q of cfg.quizQuestions) {
            const a = str(table.get(row, q.column));
            if (a) rec.answers[q.label] = a;
          }
        }
        records.push(rec);
      }
    }

    // Assignments tab
    const assignments: AssignmentRecord[] = [];
    const at = byTab.get(cfg.assignments.tab);
    if (at) {
      const col = cfg.assignments.columns;
      for (const row of at.rows) {
        const manager = str(at.get(row, [col.manager]));
        if (!manager) continue;
        assignments.push({
          id: {
            name: str(at.get(row, [col.name])),
            email: str(at.get(row, [col.email])).toLowerCase(),
            phone: str(at.get(row, [col.phone])),
          },
          manager,
          at: parseDate(at.get(row, [col.date]), order),
          by: str(at.get(row, [col.by])),
        });
      }
    }

    // Spend tab
    const spend: SpendRecord[] = [];
    const st = byTab.get(cfg.spend.tab);
    if (st) {
      const col = cfg.spend.columns;
      for (const row of st.rows) {
        const week = parseDate(st.get(row, [col.week]), order);
        const amount = Number(String(st.get(row, [col.amount])).replace(/[$,\s]/g, ''));
        if (!week || !isFinite(amount)) continue;
        spend.push({ weekStart: week.day, amount, by: str(st.get(row, [col.by])) });
      }
    }

    return { records, assignments, spend, loadedAt: Date.now(), warnings };
  }

  // ---------- writes (only the Assignments and Spend tabs) ----------

  private async headersFor(tab: string, wanted: string[]): Promise<string[]> {
    const api = this.sheets();
    const spreadsheetId = this.sheetId();
    const r = await api.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!1:1` });
    const have = (r.data.values?.[0] ?? []).map(str).filter(Boolean);
    if (have.length) return have;
    await api.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [wanted] },
    });
    return wanted;
  }

  private toRow(headers: string[], values: Record<string, string | number>): (string | number)[] {
    const byName = new Map(Object.entries(values).map(([k, v]) => [norm(k), v]));
    return headers.map((h) => byName.get(norm(h)) ?? '');
  }

  async addAssignment(a: { id: Identity; manager: string; by: string }): Promise<void> {
    const cfg = settings.sheet.assignments;
    const cols = cfg.columns;
    const headers = await this.headersFor(cfg.tab, Object.values(cols));
    const row = this.toRow(headers, {
      [cols.name]: a.id.name,
      [cols.email]: a.id.email,
      [cols.phone]: a.id.phone,
      [cols.manager]: a.manager,
      [cols.date]: new Date().toISOString(),
      [cols.by]: a.by,
    });
    await this.sheets().spreadsheets.values.append({
      spreadsheetId: this.sheetId(),
      range: `'${cfg.tab}'!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
  }

  /** One amount per week: update the row for that week if it exists, else append. */
  async setSpend(weekStart: string, amount: number, by: string): Promise<void> {
    const cfg = settings.sheet.spend;
    const cols = cfg.columns;
    const api = this.sheets();
    const spreadsheetId = this.sheetId();
    const headers = await this.headersFor(cfg.tab, Object.values(cols));
    const row = this.toRow(headers, {
      [cols.week]: weekStart,
      [cols.amount]: amount,
      [cols.by]: by,
      [cols.at]: new Date().toISOString(),
    });

    const all = await api.spreadsheets.values.get({
      spreadsheetId,
      range: `'${cfg.tab}'`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER',
    });
    const table = new Table(headers, ((all.data.values ?? []) as Cell[][]).slice(1));
    const found = table.rows.findIndex((r) => parseDate(table.get(r, [cols.week]), settings.ambiguousDateOrder)?.day === weekStart);

    if (found >= 0) {
      const sheetRow = found + 2; // header is row 1
      await api.spreadsheets.values.update({
        spreadsheetId,
        range: `'${cfg.tab}'!A${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });
    } else {
      await api.spreadsheets.values.append({
        spreadsheetId,
        range: `'${cfg.tab}'!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      });
    }
  }
}
