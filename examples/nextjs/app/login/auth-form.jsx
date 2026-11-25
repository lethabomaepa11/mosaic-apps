'use client';

import { useState } from 'react';

export default function AuthForm({ allowRegistration, registering, page }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  let title = registering ? 'Create an account' : 'Sign in';
  let submitLabel = title;
  let alternateLabel = registering ? 'Already have an account? Sign in' : 'Create an account';
  const requiredFields = registering ? ['name', 'email', 'password'] : ['email', 'password'];
  const labels = { name: 'Name', email: 'Email', password: 'Password' };
  const order = [];
  const copy = [];
  function readComponent(node, depth = 0) {
    if (!node || depth > 20) return;
    const { text, label, binding } = node.props ?? {};
    if (node.type === 'heading' && typeof text === 'string' && text.trim()) title = text;
    if (node.type === 'text' && typeof text === 'string') {
      if (typeof node.id === 'string' && node.id.endsWith('_switch')) alternateLabel = text;
      else copy.push(text);
    }
    if (node.type === 'button' && typeof label === 'string' && label.trim()) submitLabel = label;
    if (node.type === 'textField' && requiredFields.includes(binding)) {
      if (!order.includes(binding)) order.push(binding);
      if (typeof label === 'string' && label.trim()) labels[binding] = label;
    }
    if (Array.isArray(node.children)) for (const child of node.children) readComponent(child, depth + 1);
  }
  if (page?.root) readComponent(page.root);
  for (const field of requiredFields) if (!order.includes(field)) order.push(field);
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
    {copy.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    <form onSubmit={submit}>
      {order.map((field) => <label key={field}>{labels[field]} <input name={field} type={field === 'name' ? 'text' : field}
        autoComplete={field === 'password' ? (registering ? 'new-password' : 'current-password') : field === 'email' ? 'username' : 'name'}
        minLength={registering && field === 'password' ? 8 : undefined} required /></label>)}
      <button type="submit" disabled={pending}>{pending ? 'Please wait…' : submitLabel}</button>
      {error && <p role="alert">{error}</p>}
    </form>
    {allowRegistration && <p><a href={registering ? '/login' : '/signup'}>{alternateLabel}</a></p>}
  </main>;
}
