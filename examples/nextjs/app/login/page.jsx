'use client';

import { useState } from 'react';

export default function Login() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function signIn(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: fields.get('email'), password: fields.get('password') }),
      });
      if (!response.ok) throw new Error('Sign-in failed. Check your account details.');
      const next = new URL(location.href).searchParams.get('next');
      location.assign(next && /^\/(?![\/\\])/.test(next) && !/[\\\u0000-\u001f]/.test(next) ? next : '/');
    } catch (cause) {
      setError(cause.message);
      setPending(false);
    }
  }
  return <main>
    <h1>Sign in</h1>
    <form onSubmit={signIn}>
      <label>Email <input name="email" type="email" autoComplete="username" required /></label>
      <label>Password <input name="password" type="password" autoComplete="current-password" required /></label>
      <button type="submit" disabled={pending}>Sign in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </main>;
}
