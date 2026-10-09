import { fail, guard, json } from '@/lib/api';
import { leadDetail } from '@/lib/engine/metrics';
import { getModel } from '@/lib/model-cache';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await guard(req);
  if ('res' in g) return g.res;
  try {
    // Raw quiz answers are only ever included for the master role; the viewer response has no `answer` fields.
    const d = leadDetail(await getModel(), params.id, g.role === 'master');
    if (!d) return json({ error: 'Lead not found' }, 404);
    return json({ ...d, role: g.role });
  } catch (e) {
    return fail(e);
  }
}
