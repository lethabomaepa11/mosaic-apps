/** Explicit, selected-key persistence. Runtime state is in memory by default. */
import type { StateStore } from './store.js';

export interface StateStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  subscribe?(key: string, listener: (value: string | null) => void): () => void;
}

export interface StatePersistenceOptions {
  key: string;
  /** Only these top-level keys are stored or restored. */
  keys: string[];
  version?: number;
  ttlMs?: number;
  syncTabs?: boolean;
  onError?: (error: Error) => void;
}

interface Envelope { version: number; expiresAt?: number; updatedAt: number; writer: string; data: Record<string, unknown>; }
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);

export function persistState<T extends object>(store: StateStore<T>, adapter: StateStorageAdapter, options: StatePersistenceOptions): { clear(): void; dispose(): void } {
  if (!options.key.trim() || !options.keys.length || options.keys.some(key => !key || forbidden.has(key))) throw new Error('Persistence needs a storage key and safe selected state keys.');
  if (options.ttlMs !== undefined && (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0)) throw new Error('Persistence TTL must be positive.');
  const version = options.version ?? 1;
  if (!Number.isInteger(version) || version < 1) throw new Error('Persistence version must be a positive integer.');
  const writer = globalThis.crypto?.randomUUID() ?? `${Date.now()}-${Math.random()}`;
  const initial = store.snapshot();
  let applying = false;
  let disposed = false;
  let stamp: [number, string] = [0, ''];
  function report(error: unknown) { options.onError?.(error instanceof Error ? error : new Error(String(error))); }
  function resetSelected() {
    applying = true;
    try { store.update(current => {
      const next = { ...current } as Record<string, unknown>;
      for (const key of options.keys) {
        if (Object.hasOwn(initial, key)) next[key] = (initial as Record<string, unknown>)[key];
        else delete next[key];
      }
      return next as T;
    }); } finally { applying = false; }
  }
  function restore(raw: string | null, external = false) {
    if (disposed) return;
    if (raw === null) { if (external) { stamp = [Date.now(), '']; resetSelected(); } return; }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid persisted state.');
      const envelope = parsed as Envelope;
      if (envelope.version !== version) return;
      if (!Number.isFinite(envelope.updatedAt) || typeof envelope.writer !== 'string' || !envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) throw new Error('Invalid persisted state envelope.');
      if (envelope.expiresAt !== undefined && (!Number.isFinite(envelope.expiresAt) || envelope.expiresAt <= Date.now())) { if (!external) adapter.removeItem(options.key); return; }
      if (external && (envelope.updatedAt < stamp[0] || (envelope.updatedAt === stamp[0] && envelope.writer <= stamp[1]))) return;
      applying = true;
      try { store.update(current => {
        const next = { ...current } as Record<string, unknown>;
        for (const key of options.keys) {
          if (Object.hasOwn(envelope.data, key)) next[key] = envelope.data[key];
          else if (Object.hasOwn(initial, key)) next[key] = (initial as Record<string, unknown>)[key];
          else delete next[key];
        }
        return next as T;
      }); } finally { applying = false; }
      stamp = [envelope.updatedAt, envelope.writer];
    } catch (error) { report(error); }
  }
  try { restore(adapter.getItem(options.key)); } catch (error) { report(error); }
  const unsubscribe = store.subscribe(current => {
    if (applying || disposed) return;
    try {
      const updatedAt = Math.max(Date.now(), stamp[0] + 1);
      const data = Object.fromEntries(options.keys.filter(key => Object.hasOwn(current, key)).map(key => [key, (current as Record<string, unknown>)[key]]));
      const envelope: Envelope = { version, updatedAt, writer, data, ...(options.ttlMs ? { expiresAt: Date.now() + options.ttlMs } : {}) };
      adapter.setItem(options.key, JSON.stringify(envelope));
      stamp = [updatedAt, writer];
    } catch (error) { report(error); }
  }, false);
  const unsubscribeStorage = options.syncTabs ? adapter.subscribe?.(options.key, raw => restore(raw, true)) : undefined;
  return {
    clear() { if (disposed) return; try { adapter.removeItem(options.key); stamp = [Date.now(), '']; resetSelected(); } catch (error) { report(error); } },
    dispose() { disposed = true; unsubscribe(); unsubscribeStorage?.(); },
  };
}

/** Call in onMount: SSR and denied browser storage produce actionable errors. */
export function browserStateStorage(kind: 'session' | 'local' = 'session'): StateStorageAdapter {
  if (typeof window === 'undefined') throw new Error('Browser state storage is available after the application mounts.');
  const storage = kind === 'session' ? window.sessionStorage : window.localStorage;
  return {
    getItem: key => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: key => storage.removeItem(key),
    subscribe(key, listener) {
      const handler = (event: StorageEvent) => { if (event.storageArea === storage && (event.key === key || event.key === null)) listener(event.newValue); };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
  };
}
