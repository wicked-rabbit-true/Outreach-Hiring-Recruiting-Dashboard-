// One-off copy of the Google Sheet into MySQL (cleaned rows, dates normalised to UTC).
// Needs both the Google and MySQL env vars. Usage:  npm run mysql:import -- --replace
//   --replace   empties lead_records first (otherwise the script refuses to run on a non-empty table)
// Assignments and spend are copied only when those MySQL tables are empty.
import { GoogleSheetsSource } from '../lib/data/sheets';
import { getPool } from '../lib/data/mysql';
import { settings } from '../settings/settings';

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const utc = (d: { ts: number } | null) => (d ? new Date(d.ts) : null);

(async () => {
  const replace = process.argv.includes('--replace');
  const snap = await new GoogleSheetsSource().load();
  if (snap.warnings.length) console.log('Sheet warnings:\n - ' + snap.warnings.join('\n - '));
  const p = getPool();
  const t = settings.mysql.tables;

  const [[{ n }]] = (await p.query(`SELECT COUNT(*) AS n FROM \`${t.records}\``)) as unknown as [{ n: number }[]];
  if (n > 0 && !replace) throw new Error(`${t.records} already has ${n} rows. Re-run with --replace to overwrite.`);
  if (replace) await p.query(`DELETE FROM \`${t.records}\``);

  const rows = snap.records.map((r) => [
    r.kind, r.id.name, r.id.email, r.id.phone, utc(r.at), utc(r.created),
    r.meta.source ?? '', r.meta.market ?? '', r.meta.vsl ?? '', r.meta.step ?? null,
    r.meta.outcome ?? '', r.meta.by ?? '', r.meta.status ?? '', r.answers ? JSON.stringify(r.answers) : null,
  ]);
  for (const part of chunk(rows, 500)) {
    await p.query(
      `INSERT INTO \`${t.records}\` (kind,name,email,phone,action_at,created_at,source,market,vsl,step,outcome,dispoed_by,status,answers) VALUES ?`,
      [part],
    );
  }
  console.log(`Copied ${rows.length} lead records.`);

  const count = async (tbl: string) => ((await p.query(`SELECT COUNT(*) AS n FROM \`${tbl}\``)) as unknown as [{ n: number }[]])[0][0].n;
  if (snap.assignments.length && (await count(t.assignments)) === 0) {
    const a = snap.assignments.map((x) => [x.id.name, x.id.email, x.id.phone, x.manager, utc(x.at) ?? new Date(), x.by]);
    for (const part of chunk(a, 500)) await p.query(`INSERT INTO \`${t.assignments}\` (name,email,phone,manager,assigned_at,assigned_by) VALUES ?`, [part]);
    console.log(`Copied ${a.length} assignments.`);
  }
  if (snap.spend.length && (await count(t.spend)) === 0) {
    for (const s of snap.spend) {
      await p.query(`INSERT INTO \`${t.spend}\` (week_start,amount,entered_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE amount=VALUES(amount)`, [s.weekStart, s.amount, s.by ?? '']);
    }
    console.log(`Copied ${snap.spend.length} spend rows.`);
  }
  await p.end();
})().catch((e) => { console.error(e); process.exit(1); });
