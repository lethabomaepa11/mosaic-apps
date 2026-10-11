/** Shared HTTP helpers for JSON responses and error mapping. */

import type { Context } from 'hono';
import type { ApiErr, ApiOk } from '@mosaic/core';

export function ok<T>(c: Context, data: T, status = 200): Response {
  const body: ApiOk<T> = { success: true, data };
  return c.json(body as unknown as ApiOk<T>, status as 200);
}

export function fail(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 500,
  message: string,
  code?: string,
  details?: unknown,
): Response {
  const body: ApiErr = { success: false, error: { message, code, details } };
  return c.json(body as unknown as ApiErr, status);
}

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 500,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Map postgres error codes to friendly HTTP failures. */
export function mapDbError(err: unknown): HttpError | null {
  const e = err as { code?: string; constraint?: string; message?: string };
  if (!e?.code) return null;
  if (e.code === '23505') {
    return new HttpError(409, `A record with the same unique value already exists (${e.constraint ?? 'unique'})`, 'UNIQUE_VIOLATION');
  }
  if (e.code === '23503') {
    return new HttpError(409, `Related record missing or referenced (${e.constraint ?? 'foreign key'})`, 'FK_VIOLATION');
  }
  if (e.code === '23502') {
    return new HttpError(422, `Missing required column (${e.constraint ?? 'not null'})`, 'NOT_NULL');
  }
  if (e.code === '22P02' || e.code === '22007' || e.code === '22008') {
    return new HttpError(422, `Invalid value for column: ${e.message ?? 'bad input'}`, 'INVALID_INPUT');
  }
  if (e.code === '42703') {
    return new HttpError(400, `Unknown column: ${e.message ?? ''}`, 'BAD_QUERY');
  }
  return null;
}

export async function readJson<T = Record<string, unknown>>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON', 'BAD_JSON');
  }
}
