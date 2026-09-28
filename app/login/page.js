'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal masuk.');
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="container center">
      <form className="card login" onSubmit={handleSubmit}>
        <h1>Quick Link</h1>
        <p className="muted">Masukkan password untuk melanjutkan.</p>
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Memeriksa...' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
