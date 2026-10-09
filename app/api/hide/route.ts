import { fail, guard, json, sameOrigin } from '@/lib/api';
import { getSource } from '@/lib/data';
import { getModel, invalidateModel } from '@/lib/model-cache';
import { settings } from '@/settings/settings';

export const dynamic = 'force-dynamic';

// Master can hide a lead that slipped past the test filter (or restore it).
// Stored as a marker row in the Assignments tab, so no extra tab is needed.
export async function POST(req: Request) {
  const g = await guard(req, 'master');
  if ('res' in g) return g.res;
  if (!sameOrigin(req)) return json({ error: 'Bad origin' }, 403);
  try {
    const body = (await req.json()) as { personId?: string; hidden?: boolean };
    const person = (await getModel()).people.find((p) => p.id === body.personId);
    if (!person) return json({ error: 'Lead not found' }, 404);
    await getSource().addAssignment({
      id: { name: person.name, email: person.email, phone: person.phone },
      manager: body.hidden ? settings.hideMarkers.hide : settings.hideMarkers.unhide,
      by: settings.session.masterDisplayName,
    });
    invalidateModel();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
