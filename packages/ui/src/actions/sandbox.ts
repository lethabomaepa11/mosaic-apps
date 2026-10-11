import type { ComponentAction, ScriptLanguage } from '@mosaic-apps/core';
import type { SandboxRequest, SandboxResponse, ScriptStateSnapshot } from './sandbox-types.js';

export interface SandboxOptions {
  source: string;
  language?: ScriptLanguage;
  state: ScriptStateSnapshot;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function execute<T extends ComponentAction[] | boolean>(mode: SandboxRequest['mode'], options: SandboxOptions): Promise<T> {
  if (typeof Worker === 'undefined') return Promise.reject(new Error('Custom scripts require a browser Worker runtime'));
  const worker = new Worker(new URL('./script.worker.ts', import.meta.url), { type: 'module', name: 'mosaic-script-sandbox' });
  const id = crypto.randomUUID();
  const timeoutMs = Math.max(25, Math.min(2_000, options.timeoutMs ?? 500));

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      worker.terminate();
      callback();
    };
    const abort = () => finish(() => reject(new DOMException('Script cancelled', 'AbortError')));
    let timer = setTimeout(() => finish(() => reject(new Error('Script sandbox could not initialize within 15 seconds'))), 15_000);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) return abort();

    worker.onerror = (event) => finish(() => reject(new Error(event.message || 'Script worker failed')));
    worker.onmessage = (event: MessageEvent<SandboxResponse>) => {
      const response = event.data;
      if (response.id !== id) return;
      if ('phase' in response) {
        clearTimeout(timer);
        timer = setTimeout(() => finish(() => reject(new Error(`Script exceeded its ${timeoutMs}ms deadline`))), timeoutMs + 250);
        return;
      }
      if (response.ok === true) {
        const value = response.value as T;
        finish(() => resolve(value));
      } else {
        const error = response.error;
        finish(() => reject(new Error(error)));
      }
    };

    try { worker.postMessage({
      id,
      mode,
      source: options.source,
      language: options.language ?? 'typescript',
      state: JSON.parse(JSON.stringify(options.state)) as ScriptStateSnapshot,
      timeoutMs,
    } satisfies SandboxRequest); }
    catch (error) { finish(() => reject(error)); }
  });
}

export function runActionScript(options: SandboxOptions): Promise<ComponentAction[]> {
  return execute<ComponentAction[]>('actions', options);
}

export function runBooleanScript(options: SandboxOptions): Promise<boolean> {
  return execute<boolean>('boolean', options);
}


