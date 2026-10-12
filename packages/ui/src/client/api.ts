/** MosaicClient - typed fetch wrapper for the Mosaic API (part 1: core/auth/meta/entities). */

import type { AuditEntry, EntityDef, EntityWorkflow, EntityWorkflowOptions, FormDef, PageDef, QuerySpec, RefList, SettingRecord, UserRecord } from '@mosaic-apps/core';
import { buildQueryString } from '@mosaic-apps/core';

export interface ClientOptions {
  /** API base, e.g. '/api' (proxied) or 'http://localhost:3001/api' */
  baseUrl: string;
  token?: string;
  onUnauthorized?: () => void;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Ok<T> = { success: true; data: T };
type Err = { success: false; error: { message: string; code?: string; details?: unknown } };

export class MosaicClient {
  token: string | null;
  private readonly baseUrl: string;
  private readonly onUnauthorized?: () => void;
  private readonly sessionListeners = new Set<() => void>();

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.token = opts.token ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('mosaic_token') : null);
    this.onUnauthorized = opts.onUnauthorized;
  }

  get apiBase(): string {
    return this.baseUrl;
  }

  setToken(token: string | null): void {
    const changed = this.token !== token;
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem('mosaic_token', token);
      else localStorage.removeItem('mosaic_token');
    }
    if (changed) for (const listener of this.sessionListeners) listener();
  }

  /** Refresh application session state when signing in or signing out. */
  subscribeSession(listener: () => void): () => void {
    this.sessionListeners.add(listener);
    return () => { this.sessionListeners.delete(listener); };
  }

  private async request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal, redirectUnauthorized = true): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${this.baseUrl}${path}`, { method, headers, body: payload, signal });
    if (res.status === 204) return undefined as T;
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
      return undefined as T;
    }
    const parsed = json as Ok<T> | Err;
    if (res.status === 401 && redirectUnauthorized) this.onUnauthorized?.();
    if (!res.ok || (parsed && typeof parsed === 'object' && 'success' in parsed && parsed.success === false)) {
      const error = (parsed as Err).error;
      throw new ApiError(error?.message ?? `HTTP ${res.status}`, res.status, error?.code, error?.details);
    }
    return (parsed as Ok<T>).data;
  }

  /** Call a route on this client's configured API origin. Absolute and protocol-relative URLs are rejected. */
  call<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path)) {
      return Promise.reject(new Error('API action paths must be relative to the configured Mosaic API'));
    }
    return this.request<T>(method, path, body, signal);
  }

  // ---- auth ----
  login(email: string, password: string): Promise<{ token: string; user: UserRecord; expiresIn: number }> {
    return this.request('POST', '/auth/login', { email, password });
  }

  me(): Promise<{ id: string; email: string; name: string; roles: string[]; permissions: string[]; isAdmin: boolean }> {
    return this.request('GET', '/auth/me', undefined, undefined, false);
  }

  logout(): Promise<void> {
    return this.request('POST', '/auth/logout');
  }

  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.request('POST', '/auth/change-password', { currentPassword, newPassword });
  }

  // ---- meta ----
  meta(): Promise<{
    version: string;
    counts: { entities: number; forms: number; pages: number; users: number; migrations: number };
    auth: { authenticated: boolean; user: unknown | null };
  }> {
    return this.request('GET', '/meta');
  }

  // ---- entities ----
  artifactVersions(kind: 'form' | 'page', id: string): Promise<{ version: number; snapshot: Record<string, unknown>; publishedAt: string }[]> {
    return this.request('GET', `/${kind}s/${encodeURIComponent(id)}/versions`);
  }
  restoreArtifact(kind: 'form' | 'page', id: string, version: number, expectedVersion: number): Promise<FormDef | PageDef> {
    return this.request('POST', `/${kind}s/${encodeURIComponent(id)}/versions/${version}/restore`, { expectedVersion });
  }
  resolvePage(path: string): Promise<{ page: PageDef; params: Record<string, string> }> {
    return this.request('GET', `/pages/resolve?path=${encodeURIComponent(path)}`);
  }
  generateEntityWorkflow(entity: string, options: EntityWorkflowOptions = {}): Promise<EntityWorkflow> {
    return this.request('POST', '/workflows/entity', { ...options, entity });
  }
  listEntities(): Promise<
    { name: string; definition: EntityDef; label: string; labelPlural: string; version: number; updatedAt: string; rowCount: number }[]
  > {
    return this.request('GET', '/entities');
  }

  entityMeta(name: string): Promise<{ entity: EntityDef; fields: EntityDef['fields']; capabilities?: Record<'read' | 'create' | 'update' | 'delete', boolean>; endpoints: Record<string, string>; query: Record<string, unknown> }> {
    return this.request('GET', `/entities/${encodeURIComponent(name)}/meta`);
  }

  entityOptions(name: string, q?: string, limit = 50): Promise<{ value: string; label: string }[]> {
    const qs = q ? `?q=${encodeURIComponent(q)}&limit=${limit}` : `?limit=${limit}`;
    return this.request('GET', `/entities/${name}/options${qs}`);
  }

  listRecords<T = Record<string, unknown>>(
    entity: string,
    spec: Partial<QuerySpec> = {},
    extra?: { withDeleted?: boolean; signal?: AbortSignal },
  ): Promise<{ data: T[]; total: number; page: number; pageSize: number; pageCount: number }> {
    const base = buildQueryString(spec);
    const qs = extra?.withDeleted ? (base ? `${base}&withDeleted=true` : '?withDeleted=true') : base;
    return this.request('GET', `/entities/${entity}${qs}`, undefined, extra?.signal);
  }

  getRecord<T = Record<string, unknown>>(entity: string, id: string, include?: string[], signal?: AbortSignal): Promise<T> {
    return this.request('GET', `/entities/${entity}/${encodeURIComponent(id)}${include?.length ? `?include=${include.join(',')}` : ''}`, undefined, signal);
  }

  createRecord<T = Record<string, unknown>>(entity: string, data: Record<string, unknown>): Promise<T> {
    return this.request('POST', `/entities/${entity}`, data);
  }

  updateRecord<T = Record<string, unknown>>(entity: string, id: string, data: Record<string, unknown>): Promise<T> {
    return this.request('PATCH', `/entities/${entity}/${id}`, data);
  }

  deleteRecord(entity: string, id: string, force = false): Promise<{ id: string; softDeleted: boolean }> {
    return this.request('DELETE', `/entities/${entity}/${id}${force ? '?force=true' : ''}`);
  }

  saveEntity(entity: EntityDef): Promise<{ name: string; definition: EntityDef; version: number; source: string; updatedAt: string }> {
    return this.request('PUT', `/entities/${entity.name}`, { entity });
  }

  deleteEntityDef(name: string): Promise<{ name: string; deleted: boolean; note: string }> {
    return this.request('DELETE', `/entities/${name}`);
  }

  validateEntity(entity: EntityDef): Promise<{ valid: boolean; errors: string[] }> {
    return this.request('POST', '/entities/validate', { entity });
  }

  // ---- forms / pages ----
  listForms(publishedOnly = false): Promise<FormDef[]> {
    return this.request('GET', `/forms${publishedOnly ? '?published=true' : ''}`);
  }
  listFormFolders(): Promise<string[]> {
    return this.request('GET', '/forms/folders');
  }
  createFormFolder(path: string): Promise<{ path: string }> {
    return this.request('POST', '/forms/folders', { path });
  }
  renameFormFolder(from: string, to: string): Promise<{ from: string; to: string; updated: number }> {
    return this.request('POST', '/forms/folders/rename', { from, to });
  }
  deleteFormFolder(path: string): Promise<{ path: string; movedToRoot: number }> {
    return this.request('POST', '/forms/folders/delete', { path });
  }
  getForm(idOrSlug: string): Promise<FormDef> {
    return this.request('GET', `/forms/${idOrSlug}`);
  }
  createForm(input: { name: string; slug?: string; entity?: string; folder?: string; description?: string; schema?: unknown; settings?: unknown; dataSource?: unknown }): Promise<FormDef> {
    return this.request('POST', '/forms', input);
  }
  saveForm(form: Partial<FormDef> & { id: string; name: string }): Promise<FormDef> {
    return this.request('PUT', `/forms/${form.id}`, { ...form, schema: form.root });
  }
  saveAndPublishForm(form: Partial<FormDef> & { id: string; name: string; expectedVersion: number }): Promise<FormDef> {
    return this.request('PUT', `/forms/${form.id}/save-and-publish`, { ...form, schema: form.root });
  }
  publishForm(id: string): Promise<FormDef> {
    return this.request('POST', `/forms/${id}/publish`);
  }
  deleteForm(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.request('DELETE', `/forms/${id}`);
  }
  listPages(publishedOnly = false): Promise<PageDef[]> {
    return this.request('GET', `/pages${publishedOnly ? '?published=true' : ''}`);
  }
  listPageFolders(): Promise<string[]> {
    return this.request('GET', '/pages/folders');
  }
  createPageFolder(path: string): Promise<{ path: string }> {
    return this.request('POST', '/pages/folders', { path });
  }
  renamePageFolder(from: string, to: string): Promise<{ from: string; to: string; updated: number }> {
    return this.request('POST', '/pages/folders/rename', { from, to });
  }
  deletePageFolder(path: string): Promise<{ path: string; movedToRoot: number }> {
    return this.request('POST', '/pages/folders/delete', { path });
  }
  getNav(): Promise<{ items: import('@mosaic-apps/core').NavItemDef[] }> {
    return this.request('GET', '/nav');
  }
  getTheme(): Promise<import('@mosaic-apps/core').ThemeConfig> {
    return this.request('GET', '/theme');
  }
  getPage(idOrSlug: string): Promise<PageDef> {
    return this.request('GET', `/pages/${idOrSlug}`);
  }
  createPage(input: { name: string; slug?: string; route?: string; folder?: string; description?: string; schema?: unknown; settings?: unknown }): Promise<PageDef> {
    return this.request('POST', '/pages', input);
  }
  savePage(page: Partial<PageDef> & { id: string; name: string }): Promise<PageDef> {
    return this.request('PUT', `/pages/${page.id}`, { ...page, schema: page.root });
  }
  saveAndPublishPage(page: Partial<PageDef> & { id: string; name: string; expectedVersion: number }): Promise<PageDef> {
    return this.request('PUT', `/pages/${page.id}/save-and-publish`, { ...page, schema: page.root });
  }
  publishPage(id: string): Promise<PageDef> {
    return this.request('POST', `/pages/${id}/publish`);
  }
  deletePage(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.request('DELETE', `/pages/${id}`);
  }

  // ---- migrations ----
  planMigrations(entity?: string): Promise<{
    plans: { entity: string; statements: MigrationStatement[]; warnings: string[]; empty: boolean }[];
    statements: MigrationStatement[];
    warnings: string[];
    empty: boolean;
  }> {
    return this.request('GET', `/migrations/plan${entity ? `?entity=${entity}` : ''}`);
  }
  applyMigrations(opts?: { allowDestructive?: boolean; only?: string }): Promise<{ applied: { entity: string; statements: number }[]; skipped: string[]; warnings: string[] }> {
    return this.request('POST', '/migrations/apply', opts ?? {});
  }
  migrationHistory(limit = 100): Promise<{ id: string; entity: string; entityVersion: number; checksum: string; statements: unknown[]; status: string; error: string | null; appliedAt: string }[]> {
    return this.request('GET', `/migrations?limit=${limit}`);
  }

  // ---- admin ----
  listSettings(): Promise<(SettingRecord & { updatedAt: string })[]> {
    return this.request('GET', '/settings');
  }
  setSetting(key: string, value: unknown, description?: string): Promise<{ key: string; value: unknown }> {
    return this.request('PUT', '/settings', { key, value, description });
  }
  listRefLists(): Promise<RefList[]> {
    return this.request('GET', '/ref-lists');
  }
  saveRefList(name: string, data: { label?: string; items: RefList['items'] }): Promise<RefList> {
    return this.request('PUT', `/ref-lists/${name}`, data);
  }
  deleteRefList(name: string): Promise<{ name: string; deleted: boolean }> {
    return this.request('DELETE', `/ref-lists/${name}`);
  }
  listUsers(): Promise<UserRecord[]> {
    return this.request('GET', '/users');
  }
  createUser(input: { email: string; password: string; name?: string; roles?: string[] }): Promise<UserRecord> {
    return this.request('POST', '/users', input);
  }
  updateUser(id: string, patch: { name?: string; roles?: string[]; disabled?: boolean; password?: string }): Promise<UserRecord> {
    return this.request('PUT', `/users/${id}`, patch);
  }
  deleteUser(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.request('DELETE', `/users/${id}`);
  }
  listRoles(): Promise<{ name: string; displayName: string; description: string; permissions: string[] }[]> {
    return this.request('GET', '/roles');
  }
  saveRole(name: string, data: { displayName?: string; description?: string; permissions?: string[] }): Promise<{ name: string; permissions: string[] }> {
    return this.request('PUT', `/roles/${name}`, data);
  }
  listAudit(params?: { entity?: string; action?: string; page?: number; pageSize?: number }): Promise<{ data: AuditEntry[]; total: number; page: number; pageSize: number; pageCount: number }> {
    const search = params
      ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()}`
      : '';
    return this.request('GET', `/audit${search}`);
  }
}

export interface MigrationStatement {
  sql: string;
  kind: string;
  risk: string;
  description: string;
}

/** Create a client (SvelteKit apps proxy /api; studio uses PUBLIC_API_URL). */
export function createClient(opts?: Partial<ClientOptions>): MosaicClient {
  return new MosaicClient({ baseUrl: opts?.baseUrl ?? '/api', token: opts?.token, onUnauthorized: opts?.onUnauthorized });
}

