import { fail, guard, json } from '@/lib/api';
import { managersView } from '@/lib/engine/metrics';
import { getModel } from '@/lib/model-cache';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await guard(req);
  if ('res' in g) return g.res;
  try {
    const v = managersView(await getModel());
    // Viewers see results and the log, but not the assign queue.
    return json({ ...v, ready: g.role === 'master' ? v.ready : [], role: g.role });
  } catch (e) {
    return fail(e);
  }
}
