/** Endpoint registry: discovers custom API endpoint modules and exposes them to Studio/forms. */

import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';
import type { Db } from '../db/driver.js';
import { ok } from '../modules/http.js';
import { requirePermission } from '../modules/rbac.js';
import type { AuthEnv, AuthUser } from '../modules/auth.js';
import { importEntityModule } from '@mosaic-apps/core';
import { HttpError } from '../modules/http.js';

export interface EndpointDef {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description?: string;
  entity?: string;
  params?: Record<string, { type: string; required?: boolean; description?: string }>;
  body?: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  responses: Record<number, { description: string; schema?: unknown }>;
  tags?: string[];
  security?: string[];
}

export interface EndpointRegistryRow extends EndpointDef {
  handlerName: string;
}

export interface MosaicEndpointContext {
  request: Request;
  db: Db;
  user: AuthUser | null;
  params: Record<string, string>;
  query: Record<string, string>;
  json: <T = unknown>() => Promise<T>;
}

export interface MosaicEndpointRegistration extends EndpointDef {
  /** Public endpoints opt out of the authenticated-by-default policy. */
  public?: boolean;
  /** Optional Mosaic RBAC permission checked after authentication. */
  permission?: string;
  handler: (context: MosaicEndpointContext) => unknown | Promise<unknown>;
}

const ENDPOINT_FILE = /\.endpoint\.(ts|mts|js|mjs)$/;

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (ENDPOINT_FILE.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Scan a directory tree for `*.endpoint.ts|js` modules. Each module may export
 * `endpoints` (an array of `EndpointDef`) and/or `handlers` (path -> function).
 */
export async function scanApiDir(dir: string): Promise<EndpointRegistryRow[]> {
  const rows: EndpointRegistryRow[] = [];
  for (const file of await walk(dir)) {
    const mod = (await importEntityModule(pathToFileURL(file).href)) as Record<string, unknown>;
    const declared = Array.isArray(mod.endpoints) ? (mod.endpoints as EndpointDef[]) : [];
    for (const endpoint of declared) {
      rows.push({ ...endpoint, handlerName: `${file}#${endpoint.method} ${endpoint.path}` });
    }
  }
  return rows;
}

/** Directory scanned for endpoint modules (`MOSAIC_ENDPOINTS_DIR`, else the unified web app's server endpoints). */
function endpointsDir(): string {
  return resolve(process.env.MOSAIC_ENDPOINTS_DIR ?? join(process.cwd(), 'apps', 'web', 'src', 'lib', 'server', 'endpoints'));
}

function guard(user: AuthUser | null, perm: string): AuthUser {
  const authenticated = requirePermission(user, perm);
  if (!authenticated) throw new Error(user ? 'FORBIDDEN' : 'UNAUTHENTICATED');
  return user as AuthUser;
}

function normalizedPath(path: string): string {
  const normalized = `/${path}`.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  if (normalized === '/' || normalized.includes('..') || !/^\/[a-z0-9_/:.-]+$/i.test(normalized)) {
    throw new Error(`Invalid Mosaic endpoint path: ${path}`);
  }
  return normalized;
}

export function registeredEndpointRoutes(
  db: Db,
  registrations: MosaicEndpointRegistration[] = [],
  authEnabled = true,
): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  validateEndpointRegistrations(registrations);
  for (const registration of registrations) {
    const path = normalizedPath(registration.path);
    app.on(registration.method, path, async (c) => {
      const user = c.get('user');
      if (authEnabled && !registration.public && !user) {
        throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
      }
      if (registration.permission && !requirePermission(user, registration.permission)) {
        throw new HttpError(403, `Missing permission: ${registration.permission}`, 'FORBIDDEN');
      }
      const result = await registration.handler({
        request: c.req.raw,
        db,
        user,
        params: c.req.param(),
        query: c.req.query(),
        json: <T>() => c.req.json<T>(),
      });
      return result instanceof Response ? result : c.json(result ?? null);
    });
  }
  return app;
}

export function validateEndpointRegistrations(registrations: MosaicEndpointRegistration[] = []): void {
  const seen = new Set<string>();
  for (const registration of registrations) {
    const key = `${registration.method} ${normalizedPath(registration.path)}`;
    if (seen.has(key)) throw new Error(`Duplicate Mosaic endpoint registration: ${key}`);
    seen.add(key);
  }
}

export function endpointRegistryRoutes(_db: Db, registrations: MosaicEndpointRegistration[] = []): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.get('/', async (c) => {
    guard(c.get('user'), 'endpoints:read');
    const explicit: EndpointRegistryRow[] = registrations.map(({ handler: _handler, public: _public, permission: _permission, ...endpoint }) => ({
      ...endpoint,
      path: `/extensions${normalizedPath(endpoint.path)}`,
      handlerName: 'registered',
    }));
    return ok(c, [...await scanApiDir(endpointsDir()), ...explicit]);
  });

  return app;
}

