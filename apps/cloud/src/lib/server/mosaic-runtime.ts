import { randomBytes } from 'node:crypto';
import { createMosaicServer, type MosaicServer } from '@mosaic-apps/server';
import { coerceSample, type AppSpec, type CompiledApp, type SpecEntity } from './spec';

/** A Mosaic API caller: in-process for verification/preview, HTTP for a deployed app. */
export type MosaicCall = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>;

export function inProcessCaller(server: MosaicServer, token: string): MosaicCall {
  return async (method, path, body) => {
    const response = await server.app.request(path, {
      method, headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
}

export function httpCaller(baseUrl: string, token: string): MosaicCall {
  return async (method, path, body) => {
    const response = await fetch(new URL(path, baseUrl), {
      method, headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
}

export async function loginToken(call: (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>, email: string, password: string): Promise<string> {
  const result = await call('POST', '/api/auth/login', { email, password });
  if (result.status !== 200) throw new Error(`Mosaic admin sign-in failed (${result.status}): ${result.body?.error?.message ?? 'unknown error'}`);
  return result.body.data.token as string;
}

const reason = (result: { status: number; body: any }) => {
  const error = result.body?.error;
  const details = error?.details ? ` ${JSON.stringify(error.details).slice(0, 300)}` : '';
  return `${result.status} ${error?.message ?? 'unknown error'}${details}`;
};

/** Referenced entities first, so refs and foreign keys resolve. */
export function entityOrder<T extends { name: string; fields: Array<{ type: string; refEntity?: string | null }> }>(entities: T[]): T[] {
  const ordered: T[] = [];
  const visiting = new Set<string>();
  const visit = (entity: T) => {
    if (ordered.includes(entity) || visiting.has(entity.name)) return;
    visiting.add(entity.name);
    for (const field of entity.fields) {
      const target = field.type === 'ref' ? entities.find((item) => item.name === field.refEntity && item !== entity) : undefined;
      if (target) visit(target);
    }
    ordered.push(entity);
  };
  entities.forEach(visit);
  return ordered;
}

/**
 * Publishes a compiled app through Mosaic's public API: entity definitions, migrations,
 * then forms and pages. Idempotent, so it serves first deploys and later changes alike.
 */
export async function applyApp(call: MosaicCall, app: CompiledApp, options: { allowDestructive: boolean }): Promise<{ errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const entity of entityOrder(app.entities.map((def) => ({ ...def, fields: def.fields.map((field) => ({ ...field, refEntity: field.refEntity ?? null })) })))) {
    const result = await call('PUT', `/api/entities/${entity.name}`, { entity: app.entities.find((def) => def.name === entity.name), origin: 'ai', message: 'Mosaic Cloud generation' });
    if (result.status !== 200) errors.push(`Saving entity "${entity.name}" failed: ${reason(result)}`);
  }
  if (errors.length) return { errors, warnings };
  const migrated = await call('POST', '/api/migrations/apply', { allowDestructive: options.allowDestructive });
  if (migrated.status !== 200) return { errors: [`Applying migrations failed: ${reason(migrated)}`], warnings };
  for (const skipped of migrated.body?.data?.skipped ?? []) warnings.push(`Skipped destructive change: ${typeof skipped === 'string' ? skipped : JSON.stringify(skipped)}`);

  for (const [kind, artifacts] of [['forms', app.forms], ['pages', app.pages]] as const) {
    for (const artifact of artifacts as Array<Record<string, any>>) {
      const payload = { name: artifact.name, slug: artifact.slug, description: artifact.description, schema: artifact.root, settings: artifact.settings, ...(kind === 'forms' ? { entity: artifact.entity, dataSource: artifact.dataSource } : { route: artifact.route }) };
      let existing = await call('GET', `/api/${kind}/${artifact.slug}`);
      if (kind === 'pages' && ['auth-login', 'auth-signup'].includes(artifact.slug)) {
        if (existing.status === 200) continue;
        const published = await call('GET', '/api/pages?published=true');
        if (published.body?.data?.some((page: { route: string }) => page.route === artifact.route)) continue;
      }
      if (existing.status === 404 && kind === 'pages' && artifact.route === '/') {
        const pages = await call('GET', '/api/pages?published=true');
        const home = pages.body?.data?.find((page: { route: string }) => page.route === '/');
        if (home) existing = { status: 200, body: { data: home } };
      }
      const saved = existing.status === 200
        ? await call('PUT', `/api/${kind}/${existing.body.data.id}/save-and-publish`, { ...payload, expectedVersion: existing.body.data.version, origin: 'ai' })
        : await call('POST', `/api/${kind}`, payload).then(async (created) => created.status === 201 ? call('POST', `/api/${kind}/${created.body.data.id}/publish`) : created);
      if (saved.status !== 200 && saved.status !== 201) errors.push(`Publishing ${kind.slice(0, -1)} "${artifact.slug}" failed: ${reason(saved)}`);
    }
  }
  return { errors, warnings };
}

function syntheticValue(field: SpecEntity['fields'][number], index: number): unknown {
  switch (field.type) {
    case 'int': return 1 + index;
    case 'decimal': return 10 + index;
    case 'boolean': return index % 2 === 0;
    case 'date': return '2026-01-15';
    case 'datetime': return '2026-01-15T09:00:00Z';
    case 'enum': return field.options[0];
    case 'ref': return undefined;
    default: return field.format === 'email' ? `sample${index}@example.com` : field.format === 'url' ? 'https://example.com' : `${field.label} ${index + 1}`;
  }
}

/**
 * Exercises real CRUD for every entity (create with relations, list, read, update) and
 * leaves the sample records in place so the preview has data. Returns readable failures.
 */
export async function seedAndSmokeTest(call: MosaicCall, spec: AppSpec, options: { only?: Set<string>; smoke?: boolean } = {}): Promise<string[]> {
  const errors: string[] = [];
  const created = new Map<string, Array<Record<string, unknown>>>();
  const enumValue = (field: SpecEntity['fields'][number], value: unknown) => {
    if (field.type !== 'enum' || typeof value !== 'string') return value;
    const match = field.options.find((option) => option.toLowerCase() === value.toLowerCase());
    return (match ?? field.options[0]!).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  };
  for (const entity of entityOrder(spec.entities)) {
    if (options.only && !options.only.has(entity.name)) {
      // Existing records still resolve refs from newly seeded entities.
      const existing = await call('GET', `/api/entities/${entity.name}?pageSize=20`);
      created.set(entity.name, existing.body?.data?.data ?? []);
      continue;
    }
    const samples = spec.sampleData.find((sample) => sample.entity === entity.name)?.records ?? [];
    const rows = samples.length ? samples : [[], []];
    for (const [index, sample] of rows.entries()) {
      const record: Record<string, unknown> = {};
      for (const field of entity.fields) {
        const given = sample.find((item) => item.field === field.name);
        let value = given ? coerceSample(field, given.value) : (field.required || !samples.length ? syntheticValue(field, index) : undefined);
        if (field.type === 'ref') {
          const targets = created.get(field.refEntity!) ?? [];
          const targetSpec = spec.entities.find((item) => item.name === field.refEntity);
          const byLabel = given && targetSpec ? targets.find((row) => String(row[targetSpec.labelField] ?? '').toLowerCase() === given.value.toLowerCase()) : undefined;
          value = (byLabel ?? targets[index % Math.max(targets.length, 1)])?.id;
        }
        if (field.unique && typeof value === 'string' && !given) value = `${value}-${index}`;
        value = enumValue(field, value);
        if (value !== undefined && value !== null && !(typeof value === 'number' && Number.isNaN(value))) record[field.name] = value;
      }
      const result = await call('POST', `/api/entities/${entity.name}`, record);
      if (result.status !== 201) { errors.push(`Creating a ${entity.label} failed: ${reason(result)} (record: ${JSON.stringify(record).slice(0, 200)})`); continue; }
      created.set(entity.name, [...(created.get(entity.name) ?? []), result.body.data]);
    }
    const rowsMade = created.get(entity.name) ?? [];
    if (!rowsMade.length || options.smoke === false) continue;
    const list = await call('GET', `/api/entities/${entity.name}?pageSize=5`);
    if (list.status !== 200 || !(list.body?.data?.total >= 1)) errors.push(`Listing ${entity.labelPlural} failed: ${reason(list)}`);
    const first = rowsMade[0]!;
    const editable = entity.fields.find((field) => field.type === 'string' && !field.unique && !field.format);
    if (editable) {
      const patched = await call('PATCH', `/api/entities/${entity.name}/${first.id}`, { [editable.name]: `${String(first[editable.name] ?? editable.label)} (edited)`.slice(0, 200) });
      if (patched.status !== 200) errors.push(`Updating a ${entity.label} failed: ${reason(patched)}`);
    }
    const read = await call('GET', `/api/entities/${entity.name}/${first.id}`);
    if (read.status !== 200) errors.push(`Reading a ${entity.label} failed: ${reason(read)}`);
  }
  return errors;
}

/** Boots a throwaway in-memory Mosaic app, applies the compiled app, and runs CRUD on it. */
export async function verifyApp(spec: AppSpec, app: CompiledApp): Promise<string[]> {
  const password = randomBytes(12).toString('base64url');
  const server = await createMosaicServer({
    databaseUrl: 'pglite://memory', auth: { jwtSecret: randomBytes(32).toString('hex') }, cors: false,
    seed: { admin: { email: 'verify@mosaic.local', password }, demo: false },
  });
  try {
    const token = await loginToken(inProcessCaller(server, ''), 'verify@mosaic.local', password);
    const call = inProcessCaller(server, token);
    const applied = await applyApp(call, app, { allowDestructive: true });
    if (applied.errors.length) return applied.errors;
    return await seedAndSmokeTest(call, spec);
  } finally {
    await server.close();
  }
}
