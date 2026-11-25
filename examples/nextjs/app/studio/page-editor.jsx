'use client';

import { useState } from 'react';

export default function PageEditor({ page }) {
  const [schema, setSchema] = useState(JSON.stringify(page.root, null, 2));
  const [version, setVersion] = useState(page.version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function publish(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetch(`/api/pages/${encodeURIComponent(page.id)}/save-and-publish`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: page.name, route: page.route, schema: JSON.parse(schema), settings: page.settings, expectedVersion: version }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 409 ? 'This page changed. Reload before publishing again.' : result.error?.message ?? 'Could not publish the page.');
      setVersion(result.data.version);
      setSaved(true);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  return <>
    <a href="/studio">All pages</a>
    <h2>{page.name}</h2>
    <form onSubmit={publish}>
      <label>Page JSON <textarea rows={20} spellCheck={false} value={schema} onChange={(event) => setSchema(event.target.value)} required /></label>
      <button type="submit" disabled={saving}>{saving ? 'Publishing…' : 'Save and publish'}</button>
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Published version {version}.</p>}
    </form>
  </>;
}
