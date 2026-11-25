'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SidebarEditor({ initial }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [selected, select] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const active = items[selected];
  function update(key, value) {
    setItems(items.map((item, index) => index === selected ? { ...item, [key]: value } : item));
  }
  function move(offset) {
    const next = [...items], index = selected + offset;
    [next[index], next[selected]] = [next[selected], next[index]];
    setItems(next);
    select(index);
  }
  async function save() {
    const clean = items.map(({ label, href, section }) => ({ label: label.trim(), href: href.trim(), section: section?.trim() }));
    if (clean.some(({ label, href }) => !label || !/^\/(?![/\\])/.test(href) || /[\\\u0000-\u001f]/.test(href))) {
      setMessage('Every link needs a label and a safe app-relative path.');
      return;
    }
    if (new Set(clean.map(({ href }) => href)).size !== clean.length) {
      setMessage('Use a different path for each link.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'app.nav', value: clean }) });
      if (!response.ok) throw new Error('Could not save the sidebar.');
      setMessage('Sidebar saved');
      router.refresh();
    } catch (cause) {
      setMessage(cause.message);
    } finally {
      setSaving(false);
    }
  }
  return <>
    <h1>Sidebar</h1>
    <div className="form-actions">
      <button type="button" onClick={() => { select(items.length); setItems([...items, { label: 'New link', href: '' }]); }}>Add link</button>
      <button type="button" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save sidebar'}</button>
    </div>
    <p role="status">{message}</p>
    <div className="sidebar-studio">
      <nav aria-label="Sidebar canvas">{items.map((item, index) =>
        <button type="button" key={index} aria-pressed={index === selected} onClick={() => select(index)}>{item.label || 'Untitled link'}</button>)}</nav>
      {active && <div>
        <label>Label<input value={active.label} onChange={(event) => update('label', event.target.value)} /></label>
        <label>Path<input value={active.href} onChange={(event) => update('href', event.target.value)} /></label>
        <label>Section<input value={active.section ?? ''} onChange={(event) => update('section', event.target.value)} /></label>
        <div className="form-actions">
          <button type="button" disabled={selected === 0} onClick={() => move(-1)}>Move up</button>
          <button type="button" disabled={selected === items.length - 1} onClick={() => move(1)}>Move down</button>
          <button type="button" onClick={() => { setItems(items.filter((_, index) => index !== selected)); select(Math.max(0, Math.min(selected, items.length - 2))); }}>Remove</button>
        </div>
      </div>}
    </div>
  </>;
}
