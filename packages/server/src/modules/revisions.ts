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
    `SELECT ${COLUMNS} FROM mosaic_revisions
     WHERE kind = $1 AND artifact_id = $2 AND revision < $3
     ORDER BY revision DESC LIMIT 1`,
    [input.kind, input.artifactId, input.revision],
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

/** Import the pre-0.3 form version ledger without rewriting snapshots or timestamps. */
export async function migrateLegacyFormVersions(db: Db): Promise<number> {
  return db.tx(async (tx) => {
    const legacy = await tx.query<{
      form_id: string;
      version: number;
      snapshot: unknown;
      published_at: string;
    }>(
      `SELECT legacy.form_id, legacy.version, legacy.snapshot, legacy.published_at
       FROM mosaic_form_versions legacy
       WHERE NOT EXISTS (
         SELECT 1 FROM mosaic_revisions revision
         WHERE revision.kind = 'form'
           AND revision.artifact_id = legacy.form_id
           AND revision.revision = legacy.version
       )
       ORDER BY legacy.form_id, legacy.version`,
    );
    if (!legacy.rows.length) return 0;

    const affected = new Set<string>();
    let imported = 0;
    for (const item of legacy.rows) {
      const previous = await tx.query<{ id: string }>(
        `SELECT id FROM mosaic_revisions
         WHERE kind = 'form' AND artifact_id = $1 AND revision < $2
         ORDER BY revision DESC LIMIT 1`,
        [item.form_id, item.version],
      );
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO mosaic_revisions
           (id, kind, artifact_id, revision, parent_id, checksum, snapshot, message, origin, created_at)
         VALUES ($1, 'form', $2, $3, $4, $5, $6::jsonb, $7, 'system', $8)
         ON CONFLICT (kind, artifact_id, revision) DO NOTHING
         RETURNING id`,
        [
          newId('rev'), item.form_id, item.version, previous.rows[0]?.id ?? null,
          revisionChecksum(item.snapshot), JSON.stringify(item.snapshot),
          'Imported legacy form version', item.published_at,
        ],
      );
      if (inserted.rowCount) {
        imported += 1;
        affected.add(item.form_id);
      }
    }

    // A newer generic revision can already exist when an interrupted upgrade resumes.
    // Re-link the affected chain to the nearest earlier revision after all imports land.
    for (const formId of affected) {
      const chain = await tx.query<{ id: string; parent_id: string | null }>(
        `SELECT id, parent_id FROM mosaic_revisions
         WHERE kind = 'form' AND artifact_id = $1 ORDER BY revision`,
        [formId],
      );
      for (let index = 0; index < chain.rows.length; index += 1) {
        const expected = index === 0 ? null : chain.rows[index - 1]!.id;
        const current = chain.rows[index]!;
        if (current.parent_id !== expected) {
          await tx.query('UPDATE mosaic_revisions SET parent_id = $1 WHERE id = $2', [expected, current.id]);
        }
      }
    }
    return imported;
  });
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
