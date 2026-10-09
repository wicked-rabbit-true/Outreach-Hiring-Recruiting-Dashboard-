'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Could not sign in');
      window.location.assign('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="pw">Password</label>
      <input id="pw" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn primary" disabled={busy || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
