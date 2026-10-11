/** Endpoint registry: discovers custom API endpoint modules and exposes them to Studio/forms. */

import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';
import type { Db } from '../db/driver.js';
import { ok } from '../modules/http.js';
import { requirePermission } from '../modules/rbac.js';
import type { AuthEnv, AuthUser } from '../modules/auth.js';
import { importEntityModule } from '@mosaic-apps/mosaic-core';

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

/** Directory scanned for endpoint modules (`MOSAIC_ENDPOINTS_DIR`, else `apps/api/src/endpoints`). */
function endpointsDir(): string {
  return resolve(process.env.MOSAIC_ENDPOINTS_DIR ?? join(process.cwd(), 'apps', 'api', 'src', 'endpoints'));
}

function guard(user: AuthUser | null, perm: string): AuthUser {
  const authenticated = requirePermission(user, perm);
  if (!authenticated) throw new Error(user ? 'FORBIDDEN' : 'UNAUTHENTICATED');
  return user as AuthUser;
}

export function endpointRegistryRoutes(_db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.get('/', async (c) => {
    guard(c.get('user'), 'endpoints:read');
    return ok(c, await scanApiDir(endpointsDir()));
  });

  return app;
}

