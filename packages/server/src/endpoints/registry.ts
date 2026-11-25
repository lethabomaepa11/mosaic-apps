/** Endpoint registry: discovers custom API endpoint modules and exposes them to Studio/forms. */

import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';
import type { Db } from '../db/driver.js';
import { fail, ok } from '../modules/http.js';
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
    if (!requirePermission(c.get('user'), 'endpoints:read')) return fail(c, 403, 'Missing permission: endpoints:read', 'FORBIDDEN');
    const explicit: EndpointRegistryRow[] = registrations.map(({ handler: _handler, public: _public, permission: _permission, ...endpoint }) => ({
      ...endpoint,
      path: `/extensions${normalizedPath(endpoint.path)}`,
      handlerName: 'registered',
    }));
    return ok(c, [...await scanApiDir(endpointsDir()), ...explicit]);
  });

  return app;
}

export function openApiRoutes(registrations: MosaicEndpointRegistration[] = []): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.get('/', (c) => {
    if (!requirePermission(c.get('user'), 'endpoints:read')) return fail(c, 403, 'Missing permission: endpoints:read', 'FORBIDDEN');
    c.header('Cache-Control', 'private, no-store');
    return c.json(buildOpenApiDocument(registrations));
  });
  return app;
}

export function buildOpenApiDocument(registrations: MosaicEndpointRegistration[]) {
    const paths: Record<string, Record<string, object>> = {};
    for (const endpoint of registrations) {
      const route = normalizedPath(endpoint.path);
      const path = `/extensions${route.replace(/:([a-z0-9_]+)/gi, '{$1}')}`;
      const pathParams = new Set([...route.matchAll(/:([a-z0-9_]+)/gi)].map((match) => match[1]!));
      const params = new Set([...pathParams, ...Object.keys(endpoint.params ?? {})]);
      const parameters = [...params].map((name) => ({
        name, in: pathParams.has(name) ? 'path' : 'query',
        required: pathParams.has(name) || endpoint.params?.[name]?.required === true,
        description: endpoint.params?.[name]?.description,
        schema: { type: endpoint.params?.[name]?.type ?? 'string' },
      }));
      const responses = Object.fromEntries(Object.entries(endpoint.responses).map(([status, response]) => [status, {
        description: response.description,
        ...(response.schema === undefined ? {} : { content: { 'application/json': { schema: response.schema } } }),
      }]));
      const method = endpoint.method.toLowerCase();
      const operations = paths[path] ??= {};
      operations[method] = {
        operationId: `${method}${route.replace(/[^a-z\d]+(.)/gi, (_char, letter: string) => letter.toUpperCase())}`,
        summary: endpoint.summary, description: endpoint.description, tags: endpoint.tags,
        ...(parameters.length ? { parameters } : {}),
        ...(endpoint.body ? { requestBody: { required: true, content: { 'application/json': { schema: endpoint.body } } } } : {}),
        responses, security: endpoint.public && !endpoint.permission ? [] : [{ bearerAuth: [] }],
      };
    }
  return {
    openapi: '3.1.0', info: { title: 'Mosaic extensions', version: '1.0.0' },
    servers: [{ url: '/api' }], paths,
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  };
}

