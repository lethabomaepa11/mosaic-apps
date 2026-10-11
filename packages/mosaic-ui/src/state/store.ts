/**
 * Instance-scoped, serializable runtime state for forms and pages.
 * No module singleton is used: create one MosaicState per application session.
 */

export type StateListener<T extends object> = (state: Readonly<T>, revision: number) => void;

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

const unsafePathParts = new Set(['__proto__', 'prototype', 'constructor']);

function pathParts(path: string): string[] {
  const parts = path.split('.').map((part) => part.trim()).filter(Boolean);
  if (!parts.length || parts.some((part) => unsafePathParts.has(part))) throw new Error(`Invalid state path: ${path}`);
  return parts;
}

export class StateStore<T extends object> {
  private current: T;
  private initial: T;
  private currentRevision = 0;
  private listeners = new Set<StateListener<T>>();

  constructor(initial: T) {
    this.initial = clone(initial);
    this.current = clone(initial);
  }

  get revision(): number {
    return this.currentRevision;
  }

  snapshot(): Readonly<T> {
    return clone(this.current);
  }

  get<K extends keyof T>(key: K): Readonly<T>[K] {
    return clone(this.current[key]);
  }

  getPath(path: string): unknown {
    let value: unknown = this.current;
    for (const part of pathParts(path)) {
      if (!value || typeof value !== 'object') return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return clone(value);
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    if (JSON.stringify(this.current[key]) === JSON.stringify(value)) return;
    this.current = { ...this.current, [key]: clone(value) };
    this.notify();
  }

  setPath(path: string, value: unknown): void {
    const parts = pathParts(path);
    const next = clone(this.current) as Record<string, unknown>;
    let cursor = next;
    for (const part of parts.slice(0, -1)) {
      const existing = cursor[part];
      cursor[part] = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
      cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[parts.at(-1)!] = clone(value);
    this.update(() => next as T);
  }

  update(updater: (state: Readonly<T>) => T): void {
    const next = clone(updater(this.snapshot()));
    if (JSON.stringify(this.current) === JSON.stringify(next)) return;
    this.current = next;
    this.notify();
  }

  reset(initial?: T): void {
    if (initial !== undefined) this.initial = clone(initial);
    this.current = clone(this.initial);
    this.notify();
  }

  subscribe(listener: StateListener<T>, emitCurrent = true): () => void {
    this.listeners.add(listener);
    if (emitCurrent) listener(this.snapshot(), this.currentRevision);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.currentRevision += 1;
    const state = this.snapshot();
    for (const listener of this.listeners) listener(state, this.currentRevision);
  }
}

export interface MosaicStateInitials<TApp extends object, TPage extends object, TForm extends object> {
  application?: TApp;
  page?: TPage;
  form?: TForm;
}

export class MosaicState<
  TApp extends object = Record<string, unknown>,
  TPage extends object = Record<string, unknown>,
  TForm extends object = Record<string, unknown>,
> {
  readonly application: StateStore<TApp>;
  readonly page: StateStore<TPage>;
  readonly form: StateStore<TForm>;
  readonly component: StateStore<Record<string, unknown>>;

  constructor(initials: MosaicStateInitials<TApp, TPage, TForm> = {}) {
    this.application = new StateStore((initials.application ?? {}) as TApp);
    this.page = new StateStore((initials.page ?? {}) as TPage);
    this.form = new StateStore((initials.form ?? {}) as TForm);
    this.component = new StateStore({});
  }

  serialize(): {
    version: 1;
    application: Readonly<TApp>;
    page: Readonly<TPage>;
    form: Readonly<TForm>;
    component: Readonly<Record<string, unknown>>;
  } {
    return {
      version: 1,
      application: this.application.snapshot(),
      page: this.page.snapshot(),
      form: this.form.snapshot(),
      component: this.component.snapshot(),
    };
  }

  restore(snapshot: ReturnType<MosaicState<TApp, TPage, TForm>['serialize']>): void {
    if (snapshot.version !== 1) throw new Error(`Unsupported Mosaic state snapshot version: ${String(snapshot.version)}`);
    this.application.update(() => snapshot.application as TApp);
    this.page.update(() => snapshot.page as TPage);
    this.form.update(() => snapshot.form as TForm);
    this.component.update(() => snapshot.component ?? {});
  }

  /** Nested forms share app/page scopes and receive an isolated form scope. */
  forkForm<TChild extends object = Record<string, unknown>>(initial: TChild = {} as TChild): MosaicState<TApp, TPage, TChild> {
    const child = Object.create(MosaicState.prototype) as MosaicState<TApp, TPage, TChild>;
    Object.defineProperties(child, {
      application: { value: this.application, enumerable: true },
      page: { value: this.page, enumerable: true },
      form: { value: new StateStore(initial), enumerable: true },
      component: { value: new StateStore({}), enumerable: true },
    });
    return child;
  }

  /** New page and form scopes under the same application scope. */
  forkPage<TNextPage extends object = Record<string, unknown>>(initial: TNextPage = {} as TNextPage): MosaicState<TApp, TNextPage> {
    const next = Object.create(MosaicState.prototype) as MosaicState<TApp, TNextPage>;
    Object.defineProperties(next, {
      application: { value: this.application, enumerable: true },
      page: { value: new StateStore(initial), enumerable: true },
      form: { value: new StateStore({}), enumerable: true },
      component: { value: new StateStore({}), enumerable: true },
    });
    return next;
  }

  /** A component owns local state while sharing its enclosing application/page/form scopes. */
  forkComponent(initial: Record<string, unknown> = {}): MosaicState<TApp, TPage, TForm> {
    const child = Object.create(MosaicState.prototype) as MosaicState<TApp, TPage, TForm>;
    Object.defineProperties(child, {
      application: { value: this.application, enumerable: true },
      page: { value: this.page, enumerable: true },
      form: { value: this.form, enumerable: true },
      component: { value: new StateStore(initial), enumerable: true },
    });
    return child;
  }
}

export function createMosaicState<
  TApp extends object = Record<string, unknown>,
  TPage extends object = Record<string, unknown>,
  TForm extends object = Record<string, unknown>,
>(initials: MosaicStateInitials<TApp, TPage, TForm> = {}): MosaicState<TApp, TPage, TForm> {
  return new MosaicState(initials);
}

export const MOSAIC_STATE_CONTEXT = 'mosaic:runtime-state';
