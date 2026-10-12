/** Durable file content in PostgreSQL or a persistent disk volume. */
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { newId } from '@mosaic-apps/core';
import type { Db } from '../db/driver.js';
import { HttpError, fail, ok } from './http.js';
import { requirePermission } from './rbac.js';
import type { AuthEnv } from './auth.js';

export interface FilesDeps {
  db: Db;
  uploadsDir: string;
  publicRead?: boolean;
  storage?: 'disk' | 'database';
  maxFileBytes?: number;
}
interface StoredFile { id: string; filename: string; mime: string; path: string; size: number; data: Uint8Array | null; public: boolean; uploaded_by: string; }
function safeFilename(name: string) { return name.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'file'; }
function diskPath(directory: string, filename: string): string {
  const base = resolve(directory);
  const target = resolve(base, filename);
  const child = relative(base, target);
  if (!child || child.startsWith('..') || isAbsolute(child)) throw new HttpError(404, 'File content is unavailable.', 'NOT_FOUND');
  return target;
}
function imageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  const header = Buffer.from(bytes.subarray(0, 12)).toString('ascii');
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'image/gif';
  if (header.startsWith('RIFF') && header.slice(8) === 'WEBP') return 'image/webp';
  return null;
}
export function fileRoutes(deps: FilesDeps): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  const maximum = deps.maxFileBytes ?? (deps.storage === 'database' ? 4 * 1024 * 1024 : 15 * 1024 * 1024);
  app.use('*', bodyLimit({ maxSize: maximum + 512 * 1024, onError: c => fail(c, 413, 'Upload exceeds the configured size limit.', 'TOO_LARGE') }));
  app.post('/', async c => {
    const user = c.get('user');
    if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    let form: FormData;
    try { form = await c.req.formData(); } catch { throw new HttpError(400, 'Upload must use multipart form data.', 'BAD_UPLOAD'); }
    const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(422, 'multipart field "file" is required', 'BAD_INPUT');
    if (file.size > maximum) throw new HttpError(413, `File exceeds ${Math.floor(maximum / (1024 * 1024))} MiB.`, 'TOO_LARGE');
    const publicBrand = form.get('purpose') === 'brand';
    if (publicBrand && !requirePermission(user, 'settings:manage')) throw new HttpError(403, 'Brand uploads require settings management permission.', 'FORBIDDEN');
    const id = newId('file'); const filename = safeFilename(file.name);
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = publicBrand ? imageMime(bytes) : file.type || 'application/octet-stream';
    if (!mime) throw new HttpError(422, 'Logos must be PNG, JPEG, GIF or WebP images.', 'BAD_IMAGE');
    const path = deps.storage === 'database' ? `database:${id}` : `${id}_${filename}`;
    if (deps.storage !== 'database') { await mkdir(deps.uploadsDir, { recursive: true }); await writeFile(join(deps.uploadsDir, path), bytes); }
    try {
      await deps.db.tx(async tx => {
        await tx.query('INSERT INTO mosaic_files (id, filename, mime, size, path, uploaded_by, data, public) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [id, filename, mime, file.size, path, user.id, deps.storage === 'database' ? bytes : null, publicBrand]);
        await tx.query('INSERT INTO mosaic_audit_log (action, entity, record_id, user_id, user_email) VALUES ($1,$2,$3,$4,$5)', ['upload', 'file', id, user.id, user.email]);
      });
    } catch (error) {
      if (deps.storage !== 'database') await unlink(join(deps.uploadsDir, path)).catch(() => {});
      throw error;
    }
    return ok(c, { id, filename, mime, size: file.size, public: publicBrand, url: `/files/${id}` }, 201);
  });
  app.get('/', async c => {
    const user = c.get('user');
    if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const allowed = requirePermission(user, 'files:manage');
    const files = await deps.db.query<StoredFile & { created_at: string }>(`SELECT id, filename, mime, size, public, created_at FROM mosaic_files ${allowed ? '' : 'WHERE uploaded_by = $1 OR public = true'} ORDER BY created_at DESC LIMIT 200`, allowed ? [] : [user.id]);
    return ok(c, files.rows.map(row => ({ id: row.id, filename: row.filename, mime: row.mime, size: Number(row.size), public: row.public, createdAt: new Date(row.created_at).toISOString(), url: `/files/${row.id}` })));
  });
  app.get('/:id', async c => {
    const result = await deps.db.query<StoredFile>('SELECT id, filename, mime, path, data, public, uploaded_by FROM mosaic_files WHERE id = $1', [c.req.param('id')]);
    const row = result.rows[0];
    if (!row) throw new HttpError(404, 'File not found', 'NOT_FOUND');
    if (!deps.publicRead && !row.public && !c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    let bytes: Uint8Array;
    if (row.data) bytes = new Uint8Array(row.data);
    else {
      if (row.path.startsWith('database:')) throw new HttpError(404, 'File content is unavailable.', 'NOT_FOUND');
      try { bytes = new Uint8Array(await readFile(diskPath(deps.uploadsDir, row.path))); } catch { throw new HttpError(404, 'File content is unavailable.', 'NOT_FOUND'); }
    }
    const publicRead = !!deps.publicRead || row.public;
    return c.body(new Uint8Array(bytes), 200, {
      'Content-Type': row.mime,
      'Content-Disposition': `${/^image\/(png|jpeg|gif|webp)$/.test(row.mime) ? 'inline' : 'attachment'}; filename="${encodeURIComponent(row.filename)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': publicRead ? 'public, max-age=3600, immutable' : 'private, no-store',
    });
  });
  app.delete('/:id', async c => {
    const user = c.get('user');
    if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const allowed = requirePermission(user, 'files:manage');
    const row = await deps.db.tx(async tx => {
      const result = await tx.query<{ path: string }>(`DELETE FROM mosaic_files WHERE id = $1${allowed ? '' : ' AND uploaded_by = $2'} RETURNING path`, allowed ? [c.req.param('id')] : [c.req.param('id'), user.id]);
      if (!result.rows[0]) throw new HttpError(404, 'File not found or deletion is not permitted.', 'NOT_FOUND');
      await tx.query('INSERT INTO mosaic_audit_log (action, entity, record_id, user_id, user_email) VALUES ($1,$2,$3,$4,$5)', ['delete', 'file', c.req.param('id'), user.id, user.email]);
      return result.rows[0];
    });
    if (!row.path.startsWith('database:')) await unlink(diskPath(deps.uploadsDir, row.path)).catch(() => {});
    return ok(c, { id: c.req.param('id'), deleted: true });
  });
  app.onError((error, c) => {
    if (error instanceof HttpError) return fail(c, error.status, error.message, error.code, error.details);
    console.error('[mosaic] file operation failed:', (error as { code?: string }).code ?? 'STORAGE_ERROR');
    return fail(c, 500, 'File storage operation failed.', 'STORAGE_ERROR');
  });
  return app;
}
