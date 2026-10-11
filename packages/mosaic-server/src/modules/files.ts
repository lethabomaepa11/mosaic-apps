/** File uploads stored on local disk, metadata in mosaic_files. */

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import { newId } from '@mosaic-apps/mosaic-core';
import type { Db } from '../db/driver.js';
import { HttpError, fail, ok } from './http.js';
import type { AuthEnv } from './auth.js';

export interface FilesDeps {
  db: Db;
  uploadsDir: string;
  /** serve files without auth (public uploads) */
  publicRead?: boolean;
}

const MAX_SIZE = 15 * 1024 * 1024;

function safeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'file';
}

export function fileRoutes(deps: FilesDeps): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.post('/', async (c) => {
    const user = c.get('user');
    if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const form = await c.req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(422, 'multipart field "file" is required', 'BAD_INPUT');
    if (file.size > MAX_SIZE) throw new HttpError(413, 'File larger than 15MB', 'TOO_LARGE');
    const id = newId('file');
    const filename = safeFilename(file.name);
    const buf = Buffer.from(await file.arrayBuffer());
    await mkdir(deps.uploadsDir, { recursive: true });
    const diskName = `${id}_${filename}`;
    await writeFile(join(deps.uploadsDir, diskName), buf);
    const res = await deps.db.query<{ id: string; created_at: string }>(
      'INSERT INTO mosaic_files (id, filename, mime, size, path, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at',
      [id, filename, file.type || 'application/octet-stream', file.size, diskName, user.id],
    );
    return ok(c, { id, filename, mime: file.type, size: file.size, url: `/files/${id}` }, 201);
  });

  app.get('/', async (c) => {
    if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const res = await deps.db.query<{ id: string; filename: string; mime: string; size: number; created_at: string }>(
      'SELECT id, filename, mime, size, created_at FROM mosaic_files ORDER BY created_at DESC LIMIT 200',
    );
    return ok(
      c,
      res.rows.map((r) => ({
        id: r.id,
        filename: r.filename,
        mime: r.mime,
        size: Number(r.size),
        createdAt: new Date(r.created_at).toISOString(),
        url: `/files/${r.id}`,
      })),
    );
  });

  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const res = await deps.db.query<{ filename: string; mime: string; path: string }>(
      'SELECT filename, mime, path FROM mosaic_files WHERE id = $1',
      [id],
    );
    const row = res.rows[0];
    if (!row) throw new HttpError(404, 'File not found', 'NOT_FOUND');
    if (!deps.publicRead && !c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    try {
      const buf = await readFile(join(deps.uploadsDir, row.path));
      return c.body(new Uint8Array(buf), 200, {
        'Content-Type': row.mime,
        'Content-Disposition': `inline; filename="${encodeURIComponent(row.filename)}"`,
        'Cache-Control': 'public, max-age=86400',
      });
    } catch {
      throw new HttpError(404, 'File content missing on disk', 'NOT_FOUND');
    }
  });

  app.delete('/:id', async (c) => {
    const user = c.get('user');
    if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const res = await deps.db.query<{ path: string }>('DELETE FROM mosaic_files WHERE id = $1 RETURNING path', [
      c.req.param('id'),
    ]);
    const row = res.rows[0];
    if (!row) throw new HttpError(404, 'File not found', 'NOT_FOUND');
    await unlink(join(deps.uploadsDir, row.path)).catch(() => undefined);
    return ok(c, { id: c.req.param('id'), deleted: true });
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.message, err.code, err.details);
    console.error('[mosaic] files error:', err);
    return fail(c, 500, 'Internal server error', 'INTERNAL');
  });

  return app;
}

