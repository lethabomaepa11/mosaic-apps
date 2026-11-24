import { createHash } from 'node:crypto';
import { newId, type ArtifactKind, type ArtifactRevision, type RevisionOrigin } from '@mosaic-apps/core';
import type { Db } from '../db/driver.js';
import type { AuthUser } from './auth.js';

interface RevisionRow {
  id: string;
  kind: ArtifactKind;
  artifact_id: string;
  revision: number;
  parent_id: string | null;
  checksum: string;
  snapshot: unknown;
  message: string | null;
  origin: RevisionOrigin;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortKeys(item)]));
  }
  return value;
}

export function revisionChecksum(snapshot: unknown): string {
  return createHash('sha256').update(JSON.stringify(sortKeys(snapshot))).digest('hex');
}

function toRecord(row: RevisionRow): ArtifactRevision {
  return {
    id: row.id,
    kind: row.kind,
    artifactId: row.artifact_id,
    revision: row.revision,
    parentId: row.parent_id ?? undefined,
    checksum: row.checksum,
    snapshot: row.snapshot,
    message: row.message ?? undefined,
    origin: row.origin,
    authorId: row.author_id ?? undefined,
    authorName: row.author_name ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const COLUMNS = 'id, kind, artifact_id, revision, parent_id, checksum, snapshot, message, origin, author_id, author_name, created_at';

export async function recordRevision(db: Db, input: {
  kind: ArtifactKind;
  artifactId: string;
  revision: number;
  snapshot: unknown;
  message?: string;
  origin?: RevisionOrigin;
  author?: AuthUser | null;
}): Promise<ArtifactRevision> {
  const previous = await db.query<RevisionRow>(
    `SELECT ${COLUMNS} FROM mosaic_revisions WHERE kind = $1 AND artifact_id = $2 ORDER BY revision DESC LIMIT 1`,
    [input.kind, input.artifactId],
  );
  const row = await db.query<RevisionRow>(
    `INSERT INTO mosaic_revisions
       (id, kind, artifact_id, revision, parent_id, checksum, snapshot, message, origin, author_id, author_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
     RETURNING ${COLUMNS}`,
    [
      newId('rev'), input.kind, input.artifactId, input.revision, previous.rows[0]?.id ?? null,
      revisionChecksum(input.snapshot), JSON.stringify(input.snapshot), input.message?.trim() || null,
      input.origin ?? 'system', input.author?.id ?? null, input.author?.name ?? null,
    ],
  );
  return toRecord(row.rows[0]!);
}

export async function listRevisions(db: Db, kind: ArtifactKind, artifactId: string): Promise<ArtifactRevision[]> {
  const result = await db.query<RevisionRow>(
    `SELECT ${COLUMNS} FROM mosaic_revisions WHERE kind = $1 AND artifact_id = $2 ORDER BY revision DESC`,
    [kind, artifactId],
  );
  return result.rows.map(toRecord);
}

export async function getRevision(db: Db, kind: ArtifactKind, artifactId: string, revision: number): Promise<ArtifactRevision | undefined> {
  const result = await db.query<RevisionRow>(
    `SELECT ${COLUMNS} FROM mosaic_revisions WHERE kind = $1 AND artifact_id = $2 AND revision = $3`,
    [kind, artifactId, revision],
  );
  return result.rows[0] ? toRecord(result.rows[0]) : undefined;
}

export async function getPreviousRevision(db: Db, kind: ArtifactKind, artifactId: string, revision: number): Promise<ArtifactRevision | undefined> {
  const result = await db.query<RevisionRow>(
    `SELECT ${COLUMNS} FROM mosaic_revisions WHERE kind = $1 AND artifact_id = $2 AND revision < $3 ORDER BY revision DESC LIMIT 1`,
    [kind, artifactId, revision],
  );
  return result.rows[0] ? toRecord(result.rows[0]) : undefined;
}
