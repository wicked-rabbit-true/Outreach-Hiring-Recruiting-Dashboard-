// Day-1 task: print the weekly table from the LIVE sheet so it can be compared with the Stats v2 tab.
// Usage: npm run reconcile   (needs .env.local with the Google credentials)
import { buildModel } from '../lib/engine/model';
import { weekly } from '../lib/engine/metrics';
import { getSource } from '../lib/data';

(async () => {
  const snap = await getSource().load();
  const model = buildModel(snap);
  const w = weekly(model, Number(process.argv[2]) || 8);
  console.log(`people: ${model.people.length}, test leads excluded: ${model.testExcluded}`);
  if (snap.warnings.length) console.log('WARNINGS:\n - ' + snap.warnings.join('\n - '));
  console.log(['Week'.padEnd(12), ...w.columns.map((c) => c.label.slice(0, 11).padStart(11))].join(' '));
  for (const r of w.rows) console.log([r.weekStart.padEnd(12), ...w.columns.map((c) => String(r.counts[c.stage]).padStart(11))].join(' '));
  console.log(['Total'.padEnd(12), ...w.columns.map((c) => String(w.totals[c.stage]).padStart(11))].join(' '));
})().catch((e) => { console.error(e); process.exit(1); });
