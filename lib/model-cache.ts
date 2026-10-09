import { getSource } from '@/lib/data';
import { buildModel, type Model } from '@/lib/engine/model';
import { settings } from '@/settings/settings';

// In-memory cache per server instance: the sheet is read at most once every `refreshSeconds`.
// No database. If a refresh fails we keep serving the last good copy.
const g = globalThis as unknown as { __ohCache?: { model: Model; at: number }; __ohInflight?: Promise<Model> | null };

export async function getModel(force = false): Promise<Model> {
  const ttl = settings.refreshSeconds * 1000;
  const c = g.__ohCache;
  if (!force && c && Date.now() - c.at < ttl) return c.model;
  if (g.__ohInflight) return g.__ohInflight;

  g.__ohInflight = (async () => {
    try {
      const snap = await getSource().load();
      const model = buildModel(snap);
      g.__ohCache = { model, at: Date.now() };
      return model;
    } catch (err) {
      if (g.__ohCache) return g.__ohCache.model;
      throw err;
    } finally {
      g.__ohInflight = null;
    }
  })();
  return g.__ohInflight;
}

export function invalidateModel() {
  g.__ohCache = undefined;
}
