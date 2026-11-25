'use client';

import { useState } from 'react';

const numberFields = new Set(['numberField', 'currencyField', 'slider']);
const checkFields = new Set(['checkbox', 'switch']);
const inputTypes = { datePicker: 'date', timePicker: 'time', textField: 'text' };
const supported = new Set([...numberFields, ...checkFields, ...Object.keys(inputTypes), 'textArea', 'selectField', 'refSelect']);

function fieldsOf(node) {
  if (!node || node.props?.visibleIf === 'false') return [];
  const children = (node.children ?? []).flatMap(fieldsOf);
  return supported.has(node.type) && typeof node.props?.binding === 'string' && node.props.binding
    ? [node, ...children] : children;
}

export function RecordForm({ form, record, options }) {
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const fields = fieldsOf(form.root);
  const entity = form.entity ?? form.dataSource?.entity;
  if (!entity || !fields.length) return <p>This form has no supported record fields.</p>;
  const endpoint = `/api/entities/${encodeURIComponent(entity)}${record ? '/' + encodeURIComponent(record.id) : ''}`;
  async function submit(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const values = new FormData(element);
    const payload = Object.fromEntries(fields.flatMap(({ type, props }) => {
      if (props.disabled) return [];
      const value = values.get(props.binding);
      if (checkFields.has(type)) return [[props.binding, value !== null]];
      if (value === null || value === '') return record && record[props.binding] != null ? [[props.binding, null]] : [];
      return [[props.binding, numberFields.has(type) ? Number(value) : value]];
    }));
    setSaving(true);
    setStatus('');
    try {
      const response = await fetch(endpoint, {
        method: record ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error?.message ?? 'The record could not be saved.');
      }
      if (!record) element.reset();
      setStatus('Record saved.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!window.confirm('Delete this record?')) return;
    setSaving(true);
    try {
      const result = await fetch(endpoint, { method: 'DELETE' });
      if (!result.ok) throw new Error('The record could not be deleted.');
      setDeleted(true);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }
  if (deleted) return <p role="status">Record deleted.</p>;
  return <form onSubmit={submit}>
    {fields.map(({ id, type, props }) => {
      const { binding, required, disabled } = props;
      const attrs = { name: binding, required: Boolean(required), disabled: Boolean(disabled) };
      const value = record ? record[binding] : props.value;
      return <label key={id}>{props.label ?? binding}
        {type === 'textArea' ? <textarea {...attrs} defaultValue={String(value ?? '')} /> :
          type === 'selectField' || type === 'refSelect' ? <select {...attrs} defaultValue={String(value ?? '')}>
            <option value="">Select an option</option>
            {(type === 'refSelect' ? options?.[binding] : props.options)?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : checkFields.has(type) ? <input {...attrs} type="checkbox" defaultChecked={Boolean(value)} /> :
            <input {...attrs} type={numberFields.has(type) ? 'number' : props.format === 'email' ? 'email' : inputTypes[type]}
              min={props.min} max={props.max} step={numberFields.has(type) ? props.step ?? 'any' : undefined}
              placeholder={props.placeholder} defaultValue={String(value ?? '')} />}
      </label>;
    })}
    <div className="form-actions">
      <button type="submit" disabled={saving}>{saving ? 'Saving…' : form.settings?.submitLabel ?? 'Save'}</button>
      {record && <button type="button" disabled={saving} onClick={remove}>Delete record</button>}
    </div>
    <p role="status">{status}</p>
  </form>;
}
