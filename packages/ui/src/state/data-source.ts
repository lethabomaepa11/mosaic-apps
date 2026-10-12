/** Resolve form sources without eval and load them through a cancellable request. */
import type { FormDataSource } from '@mosaic-apps/core';
import type { MosaicClient } from '../client/api';

export type DataContext = Record<string, unknown>;

export function readDataPath(value: unknown, path: string): unknown {
  if (!path) return value;
  for (const key of path.split('.')) {
    if (['__proto__', 'prototype', 'constructor'].includes(key) || !key || value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function resolveValue(value: unknown, context: DataContext): unknown {
  if (typeof value === 'string' && value.startsWith('$$')) return value.slice(1);
  if (typeof value === 'string' && /^\$(application|page|form|component|query|params|data)(\.|$)/.test(value)) return readDataPath(context, value.slice(1));
  if (typeof value === 'string' && /^\{\{[^{}]+\}\}$/.test(value)) return readDataPath(context, value.slice(2, -2).trim());
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, context));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveValue(item, context)]));
  return value;
}

export function resolveFormSource(source: FormDataSource | undefined, context: DataContext): FormDataSource {
  if (!source || source.kind === 'none') return { kind: 'none' };
  if (source.kind === 'static') return { ...source, data: resolveValue(source.data, context) as Record<string, unknown> };
  if (source.kind === 'entity') {
    const id = resolveValue(source.recordId, context);
    return { ...source, recordId: id === undefined || id === null || id === '' ? undefined : String(id), where: source.where ? resolveValue(source.where, context) as Record<string, unknown> : undefined };
  }
  return { ...source, url: source.url.replace(/\{\{([^{}]+)\}\}/g, (_match, path: string) => {
    const value = readDataPath(context, path.trim());
    if (value === undefined || value === null) throw new Error(`Missing data-source value: ${path.trim()}`);
    return encodeURIComponent(String(value));
  }), body: source.body === undefined ? undefined : resolveValue(source.body, context) };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The data source must return a record object. Check its record path.');
  return value as Record<string, unknown>;
}

export async function loadFormSource(source: FormDataSource, client: MosaicClient | undefined, options: { signal?: AbortSignal; requireRecord?: boolean; fetch?: typeof fetch } = {}): Promise<Record<string, unknown>> {
  if (source.kind === 'none') return {};
  if (source.kind === 'static') return record(source.data);
  if (!client) throw new Error('Connect an API client to load this form.');
  if (source.kind === 'entity') {
    if (source.recordId) return client.getRecord(source.entity, source.recordId, undefined, options.signal);
    const filters = Object.entries(source.where ?? {}).map(([field, value]) => ({ field, op: 'eq' as const, value }));
    if (!filters.length) {
      if (options.requireRecord) throw new Error('Select a record to open this view.');
      return {};
    }
    const result = await client.listRecords(source.entity, { filters, page: 1, pageSize: 1 }, { signal: options.signal });
    if (!result.data.length) throw new Error('No record matches this form’s data source.');
    return result.data[0]!;
  }
  const origin = typeof location === 'undefined' ? 'http://localhost' : location.origin;
  const api = new URL(client.apiBase.endsWith('/') ? client.apiBase : `${client.apiBase}/`, origin);
  const url = new URL(source.url, api);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Data-source URLs must use HTTP or HTTPS.');
  const headers: Record<string, string> = { Accept: 'application/json' };
  // A configured external integration must never receive the Mosaic access token.
  if (url.origin === api.origin && client.token) headers.Authorization = `Bearer ${client.token}`;
  if (source.method === 'POST' && source.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await (options.fetch ?? fetch)(url, { method: source.method ?? 'GET', headers, body: source.method === 'POST' && source.body !== undefined ? JSON.stringify(source.body) : undefined, signal: options.signal });
  let result: unknown;
  try { result = await response.json(); }
  catch { throw new Error('The data source did not return JSON. Check its endpoint URL.'); }
  if (!response.ok || (result && typeof result === 'object' && (result as { success?: boolean }).success === false)) {
    const message = readDataPath(result, 'error.message');
    throw new Error(typeof message === 'string' ? message : `Data source failed (${response.status}).`);
  }
  const payload = source.recordPath ? readDataPath(result, source.recordPath) : result && typeof result === 'object' && (result as { success?: boolean }).success === true ? readDataPath(result, 'data') : result;
  return record(payload);
}
