import { buildPageRoute, evaluateBoolean, validateComponentActions, type ActionExecutionState, type ComponentAction, type StateScope } from '@mosaic-apps/core';
import { readDataPath } from '../state/data-source.js';
import type { MosaicClient } from '../client/api.js';
import type { MosaicState, StateStore } from '../state/store.js';
import { runActionScript } from './sandbox.js';
import type { ScriptStateSnapshot } from './sandbox-types.js';

export interface ActionContext {
  client?: MosaicClient;
  state: MosaicState;
  data?: Record<string, unknown>;
  navigate?: (href: string, newTab: boolean) => void | Promise<void>;
  notify?: (variant: 'info' | 'success' | 'warning' | 'error', title: string, description?: string) => void;
  confirm?: (options: { title: string; description?: string; confirmLabel?: string; cancelLabel?: string; signal: AbortSignal }) => Promise<boolean>;
}

function scopeStore(state: MosaicState, scope: StateScope): StateStore<Record<string, unknown>> {
  return state[scope] as StateStore<Record<string, unknown>>;
}

function readPath(value: unknown, path: string): unknown {
  return readDataPath(value, path);
}

export function actionScope(context: ActionContext, result?: unknown): ScriptStateSnapshot & Record<string, unknown> {
  return {
    application: context.state.application.snapshot(),
    page: context.state.page.snapshot(),
    form: context.state.form.snapshot(),
    component: context.state.component.snapshot(),
    data: context.data ? JSON.parse(JSON.stringify(context.data)) as Record<string, unknown> : context.state.form.snapshot(),
    result,
  };
}

function resolveValue(value: unknown, scope: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, scope));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, resolveValue(item, scope)]));
  }
  if (typeof value !== 'string') return value;
  const exact = value.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
  if (exact) return readPath(scope, exact[1]!);
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => String(readPath(scope, path) ?? ''));
}

function defaultNavigate(href: string, newTab: boolean): void {
  if (typeof window === 'undefined') return;
  if (newTab) window.open(href, '_blank', 'noopener,noreferrer');
  else window.location.assign(href);
}

function navigationHref(action: Extract<ComponentAction, { type: 'navigate' }>, scope: Record<string, unknown>): string {
  const to = String(resolveValue(action.to, scope) ?? '').trim();
  if (!to) throw new Error('Navigation target is required');
  if (action.target === 'form') return `/f/${encodeURIComponent(to)}`;
  if (action.target === 'page') return `/p/${encodeURIComponent(to)}`;
  if (!(to.startsWith('/') && !to.startsWith('//') && !to.includes('\\')) && !/^https?:\/\//i.test(to)) throw new Error('URL actions require a relative path or an HTTP(S) URL');
  return to;
}

export class ActionRunner {
  private controllers = new Map<string, AbortController>();

  constructor(private readonly context: ActionContext) {}

  cancel(key: string): void {
    this.controllers.get(key)?.abort();
  }

  async execute(key: string, actions: ComponentAction[]): Promise<unknown> {
    this.cancel(key);
    const controller = new AbortController();
    this.controllers.set(key, controller);
    this.setStatus(key, { status: 'running', startedAt: new Date().toISOString() });
    try {
      validateComponentActions(actions);
      const result = await this.runActions(actions, controller);
      if (this.controllers.get(key) === controller) this.setStatus(key, { status: 'succeeded', finishedAt: new Date().toISOString() });
      return result;
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        if (this.controllers.get(key) === controller) this.setStatus(key, { status: 'cancelled', finishedAt: new Date().toISOString() });
        return undefined;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (this.controllers.get(key) === controller) this.setStatus(key, { status: 'failed', finishedAt: new Date().toISOString(), error: message });
      throw error;
    } finally {
      if (this.controllers.get(key) === controller) this.controllers.delete(key);
    }
  }

  private async runActions(actions: ComponentAction[], controller: AbortController, initialResult?: unknown): Promise<unknown> {
    validateComponentActions(actions);
    let result = initialResult;
    for (const action of actions) {
      if (controller.signal.aborted) throw new DOMException('Action cancelled', 'AbortError');
      const scope = actionScope(this.context, result);
      if (action.when && !evaluateBoolean(action.when, scope, false)) continue;
      if (action.type === 'script') {
        const generated = await runActionScript({
          source: action.source,
          language: action.language,
          timeoutMs: action.timeoutMs,
          state: actionScope(this.context),
          signal: controller.signal,
        });
        result = await this.runActions(generated, controller, result);
      } else if (action.type === 'confirm') {
        const options = { title: String(resolveValue(action.title, scope) ?? 'Continue?'), description: String(resolveValue(action.description, scope) ?? ''), confirmLabel: action.confirmLabel, cancelLabel: action.cancelLabel, signal: controller.signal };
        const confirmed = this.context.confirm ? await this.context.confirm(options) : typeof window !== 'undefined' && window.confirm([options.title, options.description].filter(Boolean).join('\n\n'));
        if (!confirmed) { controller.abort(); throw new DOMException('Action cancelled', 'AbortError'); }
      } else if (action.type === 'message') {
        const title = String(resolveValue(action.title, scope) ?? '');
        const description = String(resolveValue(action.description, scope) ?? '');
        this.context.notify?.(action.variant ?? 'info', title, description || undefined);
        result = undefined;
      } else if (action.type === 'navigate') {
        const href = action.target === 'page' && this.context.client
          ? buildPageRoute((await this.context.client.getPage(String(resolveValue(action.to, scope) ?? ''))).route,
            resolveValue(action.params ?? readPath(scope, 'page.params') ?? {}, scope) as Record<string, unknown>)
          : navigationHref(action, scope);
        if (controller.signal.aborted) throw new DOMException('Action cancelled', 'AbortError');
        await (this.context.navigate ?? defaultNavigate)(href, action.newTab ?? false);
        result = href;
      } else if (action.type === 'state.set') {
        result = resolveValue(action.value, scope);
        scopeStore(this.context.state, action.target.scope).setPath(action.target.path, result);
      } else if (action.type === 'api') {
        if (!this.context.client) throw new Error('API actions require a Mosaic client');
        const path = String(resolveValue(action.path, scope) ?? '');
        const body = resolveValue(action.body, scope);
        result = await this.context.client.call(action.method ?? 'GET', path, body, controller.signal);
        if (action.result) scopeStore(this.context.state, action.result.scope).setPath(action.result.path, result);
      }
    }
    return result;
  }

  private setStatus(key: string, status: ActionExecutionState): void {
    const current = this.context.state.component.get('actions') as Record<string, ActionExecutionState> | undefined;
    this.context.state.component.set('actions', { ...(current ?? {}), [key]: status });
  }
}

export function createActionRunner(context: ActionContext): ActionRunner {
  return new ActionRunner(context);
}

