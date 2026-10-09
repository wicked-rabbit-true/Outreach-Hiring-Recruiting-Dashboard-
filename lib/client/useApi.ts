'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Fetch JSON from our own API and refresh it on an interval (2 minutes by default). */
export function useApi<T>(url: string | null, refreshMs = 120_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const mine = ++seq.current;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const body = await res.json();
      if (mine !== seq.current) return; // a newer request superseded this one
      if (!res.ok) throw new Error(body?.error ?? 'Request failed');
      setData(body as T);
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    setLoading(true);
    load();
    if (!refreshMs) return;
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
  }, [load, refreshMs]);

  return { data, error, loading, reload: load };
}

export async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b?.error ?? 'Request failed');
  }
}
