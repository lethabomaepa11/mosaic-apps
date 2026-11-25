'use client';

import { useState } from 'react';

const numberFields = new Set(['numberField', 'currencyField', 'slider']);
const checkFields = new Set(['checkbox', 'switch']);
const inputTypes = { datePicker: 'date', timePicker: 'time', textField: 'text' };
const supported = new Set([...numberFields, ...checkFields, ...Object.keys(inputTypes), 'textArea', 'selectField']);

function fieldsOf(node) {
  if (!node || node.props?.visibleIf === 'false') return [];
  const children = (node.children ?? []).flatMap(fieldsOf);
  return supported.has(node.type) && typeof node.props?.binding === 'string' && node.props.binding
    ? [node, ...children] : children;
}

export function RecordForm({ form }) {
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const fields = fieldsOf(form.root);
  const entity = form.entity ?? form.dataSource?.entity;
  if (!entity || !fields.length) return <p>This form has no supported record fields.</p>;
  async function submit(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const values = new FormData(element);
    const record = Object.fromEntries(fields.flatMap(({ type, props }) => {
      if (props.disabled) return [];
      const value = values.get(props.binding);
      if (checkFields.has(type)) return [[props.binding, value !== null]];
      return value === null || value === '' ? [] : [[props.binding, numberFields.has(type) ? Number(value) : value]];
    }));
    setSaving(true);
    setStatus('');
    try {
      const response = await fetch(`/api/entities/${encodeURIComponent(entity)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(record),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error?.message ?? 'The record could not be saved.');
      }
      element.reset();
      setStatus('Record saved.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }
  return <form onSubmit={submit}>
    {fields.map(({ id, type, props }) => {
      const { binding, required, disabled } = props;
      const attrs = { name: binding, required: Boolean(required), disabled: Boolean(disabled) };
      return <label key={id}>{props.label ?? binding}
        {type === 'textArea' ? <textarea {...attrs} defaultValue={String(props.value ?? '')} /> :
          type === 'selectField' ? <select {...attrs} defaultValue={String(props.value ?? '')}>
            <option value="">Select an option</option>
            {props.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : checkFields.has(type) ? <input {...attrs} type="checkbox" defaultChecked={Boolean(props.value)} /> :
            <input {...attrs} type={numberFields.has(type) ? 'number' : props.format === 'email' ? 'email' : inputTypes[type]}
              min={props.min} max={props.max} step={numberFields.has(type) ? props.step ?? 'any' : undefined}
              placeholder={props.placeholder} defaultValue={String(props.value ?? '')} />}
      </label>;
    })}
    <button type="submit" disabled={saving}>{saving ? 'Saving…' : form.settings?.submitLabel ?? 'Save'}</button>
    <p role="status">{status}</p>
  </form>;
}
