'use client';

import { useState } from 'react';

export default function AuthForm({ allowRegistration, registering }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const title = registering ? 'Create an account' : 'Sign in';
  async function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const response = await fetch(registering ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(fields)),
      });
      if (!response.ok) throw new Error(response.status === 409 ? 'This email already has an account.' : `${registering ? 'Account creation' : 'Sign-in'} failed. Check your account details.`);
      const next = new URL(location.href).searchParams.get('next');
      location.assign(next && /^\/(?![\/\\])/.test(next) && !/[\\\u0000-\u001f]/.test(next) ? next : '/');
    } catch (cause) {
      setError(cause.message);
      setPending(false);
    }
  }
  return <main>
    <h1>{title}</h1>
    <form onSubmit={submit}>
      {registering && <label>Name <input name="name" autoComplete="name" required /></label>}
      <label>Email <input name="email" type="email" autoComplete="username" required /></label>
      <label>Password <input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 8 : undefined} required /></label>
      <button type="submit" disabled={pending}>{pending ? 'Please wait…' : title}</button>
      {error && <p role="alert">{error}</p>}
    </form>
    {allowRegistration && <p><a href={registering ? '/login' : '/login?mode=signup'}>{registering ? 'Already have an account? Sign in' : 'Create an account'}</a></p>}
  </main>;
}
