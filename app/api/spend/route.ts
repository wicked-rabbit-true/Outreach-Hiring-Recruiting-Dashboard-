import { fail, guard, json, sameOrigin } from '@/lib/api';
import { isDayKey, weekStart } from '@/lib/dates';
import { getSource } from '@/lib/data';
import { invalidateModel } from '@/lib/model-cache';
import { settings } from '@/settings/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const g = await guard(req, 'master');
  if ('res' in g) return g.res;
  if (!sameOrigin(req)) return json({ error: 'Bad origin' }, 403);
  try {
    const body = (await req.json()) as { weekStart?: string; amount?: number };
    const amount = Number(body.amount);
    if (!isDayKey(body.weekStart)) return json({ error: 'weekStart must be YYYY-MM-DD' }, 400);
    if (!isFinite(amount) || amount < 0 || amount > 10_000_000) return json({ error: 'Enter a valid amount' }, 400);

    await getSource().setSpend(weekStart(body.weekStart), Math.round(amount * 100) / 100, settings.session.masterDisplayName);
    invalidateModel();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
