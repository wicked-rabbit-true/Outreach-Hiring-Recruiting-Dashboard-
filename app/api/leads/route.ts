import { fail, guard, json } from '@/lib/api';
import { leadsList } from '@/lib/engine/metrics';
import { resolveRange } from '@/lib/engine/range';
import { getModel } from '@/lib/model-cache';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req);
  if ('res' in g) return g.res;
  try {
    const sp = new URL(req.url).searchParams;
    const r = resolveRange(sp);
    const out = leadsList(await getModel(), {
      stage: sp.get('stage') || 'leads',
      range: { from: r.from, to: r.to },
      q: sp.get('q') ?? '',
      manager: sp.get('manager') ?? '',
      source: sp.get('source') ?? '',
      showHidden: g.role === 'master' && sp.get('hidden') === '1',
    });
    return json({ ...out, range: { from: r.from, to: r.to }, preset: r.preset, role: g.role });
  } catch (e) {
    return fail(e);
  }
}
