import { validatePageRoute } from '@mosaic-apps/core';
import type { Db } from '../db/driver.js';
import { HttpError } from './http.js';

/** All page route writes take this lock, including generation and restoration. */
export async function reservePageRoute(tx: Db, route: string, currentId = ''): Promise<void> {
  try { validatePageRoute(route); } catch (error) { throw new HttpError(422, error instanceof Error ? error.message : 'Invalid route.', 'BAD_ROUTE'); }
  await tx.query("INSERT INTO mosaic_locks (name) VALUES ('page-routes') ON CONFLICT (name) DO NOTHING");
  await tx.query("SELECT name FROM mosaic_locks WHERE name = 'page-routes' FOR UPDATE");
  const pattern = (value: string) => value.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':parameter');
  const result = await tx.query<{ id: string; route: string }>('SELECT id,route FROM mosaic_pages WHERE id <> $1', [currentId]);
  if (result.rows.some(row => pattern(row.route) === pattern(route))) throw new HttpError(409, 'Another page uses this route pattern. Choose a different route.', 'ROUTE_EXISTS');
}
