import { fail, guard, json } from '@/lib/api';
import { dashboard, weekly } from '@/lib/engine/metrics';
import { resolveRange } from '@/lib/engine/range';
import { getModel } from '@/lib/model-cache';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req);
  if ('res' in g) return g.res;
  try {
    const url = new URL(req.url);
    const model = await getModel();
    const r = resolveRange(url.searchParams);
    const weeks = Math.min(26, Math.max(1, Number(url.searchParams.get('weeks')) || 8));
    const d = dashboard(model, { from: r.from, to: r.to }, r.prev);
    return json({
      ...d,
      preset: r.preset,
      weekly: weekly(model, weeks),
      role: g.role,
      testExcluded: g.role === 'master' ? model.testExcluded : undefined,
      warnings: g.role === 'master' ? model.warnings : [],
    });
  } catch (e) {
    return fail(e);
  }
}
