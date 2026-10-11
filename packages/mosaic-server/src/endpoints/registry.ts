/** Endpoint registry: discovers custom API endpoints and exposes them to Studio/forms. */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Db } from '../db/driver.js';
import { HttpError, fail, ok, readJson } from '../modules/http.js';
import { requirePermission } from '../modules/rbac.js';
import type { AuthEnv, AuthUser } from '../modules/auth.js';
import { Hono } from 'hono';

export interface EndpointDef {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description?: string;
  entity?: string; // associated entity, if any
  params?: Record<string, { type: string; required?: boolean; description?: string }>;
  body?: { type: 'object'; properties: Record<string, any>; required?: string[] };
  responses: Record<number, { description: string; schema?: any }>;
  tags?: string[];
  security?: string[];
}

export interface EndpointRegistryRow {
  method: string;
  path: string;
  handlerName: string;
  entity?: string;
  summary: string;
  description?: string;
  tags?: string[];
}

function guard(user: AuthUser | null, perm: string): AuthUser {
  const hasPerm = requirePermission(user, perm);
  if (!hasPerm) {
    throw new Error(user ? 'FORBIDDEN' : 'UNAUTHENTICATED');
  }
  return user as AuthUser;
}

async function scanApiDir(dir: string): Promise<EndpointRegistryRow[]> {
  // Scan apps/api/src/routes for custom endpoints
  // Returns endpoint metadata
  return [];
}

export function endpointRegistryRoutes(db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.get('/', async (c) => {
    const user = guard(c.get('user'), 'endpoints:read');
    const env = c.env as { API_DIR?: string };\n    const apiDir = env.API_DIR ?? ?? 'apps/api/src';
    const endpoints = await scanApiDir(resolve(apiDir));
    return ok(c, endpoints);
  });

  return app;
}

export { scanApiDir };

export { guard };

export { fail, ok, readJson, HttpError } from '../modules/http.js';
export { requirePermission } from '../modules/rbac.js';
export type { AuthEnv, AuthUser } from '../modules/auth.js';






