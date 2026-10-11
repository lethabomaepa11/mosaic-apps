/** Project commands: entity scaffold + info + studio. */

import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { humanize, snakeCase, validateEntity, type EntityDef, type FieldDef } from '@mosaic/core';
import { entitiesDirOf, findRepoRoot, loadProjectConfig, titleCase } from './project.js';

function parseFields(spec: string): FieldDef[] {
  return spec
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, type = 'string', extra] = part.split(':');
      const field: FieldDef = {
        name: name![0]!.toLowerCase() + name!.slice(1),
        label: titleCase(name!),
        type: type as FieldDef['type'],
      };
      if (type === 'ref' && extra) field.refEntity = extra;
      if (type === 'enum' && extra) field.options = extra.split('|');
      return field;
    });
}

function generateEntityClass(def: EntityDef, className: string): string {
  const lines: string[] = [];
  lines.push(`import { Entity, Field, Relation } from '@mosaic/core';`);
  lines.push('');
  lines.push(`@Entity({`);
  lines.push(`  name: '${def.name}',`);
  lines.push(`  label: '${def.label}',`);
  lines.push(`  labelPlural: '${def.labelPlural}',`);
  if (def.icon) lines.push(`  icon: '${def.icon}',`);
  lines.push(`  softDelete: ${def.softDelete},`);
  lines.push(`  timestamps: ${def.timestamps ?? true},`);
  lines.push(`  audit: ${def.audit ?? true},`);
  lines.push(`  list: { defaultSort: '-createdAt' },`);
  lines.push(`  permissions: {`);
  lines.push(`    read: ['*'],`);
  lines.push(`    create: ['admin', 'editor'],`);
  lines.push(`    update: ['admin', 'editor'],`);
  lines.push(`    delete: ['admin'],`);
  lines.push(`  },`);
  lines.push(`})`);
  lines.push(`export class ${className} {`);
  for (const field of def.fields) {
    if (field.type === 'ref') {
      const opts: string[] = [`entity: '${field.refEntity}'`];
      if (field.required) opts.push('required: true');
      if (field.onDelete && field.onDelete !== 'restrict') opts.push(`onDelete: '${field.onDelete}'`);
      if (field.label) opts.push(`label: '${field.label}'`);
      lines.push(`  @Relation({ ${opts.join(', ')} })`);
    } else {
      const fieldOpts: string[] = [`type: '${field.type}'`];
      if (field.label) fieldOpts.push(`label: '${field.label}'`);
      if (field.required) fieldOpts.push('required: true');
      if (field.unique) fieldOpts.push('unique: true');
      if (field.indexed) fieldOpts.push('indexed: true');
      if (field.searchable) fieldOpts.push('searchable: true');
      if (field.length) fieldOpts.push(`length: ${field.length}`);
      if (field.maxLength) fieldOpts.push(`maxLength: ${field.maxLength}`);
      if (field.minLength) fieldOpts.push(`minLength: ${field.minLength}`);
      if (field.precision) fieldOpts.push(`precision: ${field.precision}`);
      if (field.scale) fieldOpts.push(`scale: ${field.scale}`);
      if (field.format) fieldOpts.push(`format: '${field.format}'`);
      if (field.min !== undefined) fieldOpts.push(`min: ${field.min}`);
      if (field.max !== undefined) fieldOpts.push(`max: ${field.max}`);
      if (field.default !== undefined) fieldOpts.push(`default: ${JSON.stringify(field.default)}`);
      if (field.options) fieldOpts.push(`options: ${JSON.stringify(field.options)}`);
      if (field.readonly) fieldOpts.push('readonly: true');
      if (field.ui) fieldOpts.push(`ui: ${JSON.stringify(field.ui)}`);
      lines.push(`  @Field({ ${fieldOpts.join(', ')} })`);
    }
    lines.push(`  ${field.name}!: ${tsType(field.type)};`);
    lines.push('');
  }
  lines.push('}');
  return lines.join('\n');
}

function tsType(type: string): string {
  switch (type) {
    case 'string':
    case 'text':
    case 'enum':
    case 'file':
    case 'id':
    case 'ref':
      return 'string';
    case 'int':
      return 'number';
    case 'decimal':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'datetime':
      return 'Date';
    case 'json':
      return 'any';
    default:
      return 'any';
  }
}

function pascalCase(input: string): string {
  return input
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

export async function entity(opts: { dir: string; name: string; fields?: string; softDelete: boolean }): Promise<void> {
  await loadProjectConfig(opts.dir); // validates we're in a project
  const name = snakeCase(opts.name);
  const label = humanize(name);
  const def: EntityDef = {
    name,
    label,
    labelPlural: `${label}s`,
    icon: 'table',
    softDelete: opts.softDelete,
    list: { defaultSort: '-createdAt' },
    permissions: { read: ['*'], create: ['admin', 'editor'], update: ['admin', 'editor'], delete: ['admin'] },
    fields: opts.fields ? parseFields(opts.fields) : [{ name: 'name', label: 'Name', type: 'string', required: true }],
  };
  const errors = validateEntity(def);
  if (errors.length) {
    console.error('Invalid entity:');
    for (const e of errors) console.error(`  • ${e}`);
    process.exit(1);
  }
  const dir = entitiesDirOf(opts.dir);
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${name}.entity.ts`);
  if (existsSync(file)) {
    console.error(`${file} already exists — edit it instead.`);
    process.exit(1);
  }
  await writeFile(file, generateEntityClass(def, pascalCase(name)) + '\n', 'utf8');
  console.log(`✓ Created ${file}`);
  console.log('  Next: mosaic migrate  (or npm run migrate)');
}

export async function info(opts: { dir: string }): Promise<void> {
  const config = await loadProjectConfig(opts.dir);
  console.log(`\n▦ ${config.name} (${config.slug})`);
  console.log(`  database : ${config.databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
  console.log(`  auth     : ${config.auth ? 'on' : 'off'}`);
  console.log(`  pwa      : ${config.pwa ? 'on' : 'off'}`);
  console.log(`  api port : ${config.api.port}`);
  console.log(`  web port : ${config.web.port}`);
  try {
    const res = await fetch(`http://localhost:${config.api.port}/api/health`);
    const json = (await res.json()) as { data?: { ok: boolean; version: string; db: boolean } };
    if (json.data?.ok) console.log(`  server   : up (v${json.data.version}, db: ${json.data.db ? 'connected' : 'DOWN'})`);
    else console.log('  server   : unhealthy');
  } catch {
    console.log('  server   : not running (start with npm run dev)');
  }
  console.log('');
}

export async function studio(opts: { dir: string; port?: number }): Promise<void> {
  const config = await loadProjectConfig(opts.dir);
  const repo = findRepoRoot(opts.dir) ?? findRepoRoot(import.meta.url);
  if (!repo || !existsSync(join(repo, 'apps', 'studio'))) {
    console.error(
      'Mosaic Studio not found. It ships with the mosaic-apps monorepo:\n' +
        '  clone the repo, npm install, then: npm run dev:studio\n' +
        `  then point it at this project's API: http://localhost:${config.api.port}`,
    );
    process.exit(1);
  }
  console.log(`\n▦ Starting Mosaic Studio → http://localhost:${config.api.port}\n`);
  const child = spawn('npm', ['run', 'dev', '-w', 'studio'], {
    cwd: repo,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, PUBLIC_API_URL: `http://localhost:${config.api.port}/api`, PORT: String(opts.port ?? 4173) },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

export async function listEntityFiles(dir: string): Promise<string[]> {
  const entitiesDir = entitiesDirOf(dir);
  if (!existsSync(entitiesDir)) return [];
  const files = await readdir(entitiesDir);
  const { readFile } = await import('node:fs/promises');
  const out: string[] = [];
  for (const f of files.filter((f) => f.endsWith('.entity.json'))) {
    out.push(await readFile(join(entitiesDir, f), 'utf8'));
  }
  return out;
}
