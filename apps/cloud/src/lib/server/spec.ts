import type { EntityDef, FieldDef, FormDef, FormNode, PageDef } from '@mosaic-apps/core';
import { RESERVED_ENTITY_NAMES } from '@mosaic-apps/server';

/**
 * The AI writes only this small app spec. Everything Mosaic needs (entities, forms,
 * pages) is compiled from it deterministically, so a valid spec is a working app.
 */
export type SpecFieldType = 'string' | 'text' | 'int' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'enum' | 'ref';
export interface SpecField {
  name: string; label: string; type: SpecFieldType; required: boolean; unique: boolean; searchable: boolean;
  // No nullable keys: models drop them under strict schemas. Empty string means "none".
  options: string[]; refEntity: string; format: '' | 'email' | 'url' | 'phone' | 'money';
}
export interface SpecEntity {
  name: string; label: string; labelPlural: string; icon: string; description: string; labelField: string;
  fields: SpecField[]; permissions: { read: string[]; create: string[]; update: string[]; delete: string[] };
}
export interface SpecPage { slug: string; title: string; route: string; kind: 'home' | 'dashboard' | 'list'; entity: string; description: string; access: 'public' | 'authenticated'; inMenu: boolean; icon: string }
export interface SpecSample { entity: string; records: Array<Array<{ field: string; value: string }>> }
export interface AppSpec { name: string; summary: string; roles: string[]; entities: SpecEntity[]; pages: SpecPage[]; sampleData: SpecSample[]; workflows: string[] }

const str = { type: 'string' } as const;
const strList = { type: 'array', items: str } as const;
export const APP_SPEC_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['name', 'summary', 'roles', 'entities', 'pages', 'sampleData', 'workflows'],
  properties: {
    name: str, summary: str, roles: strList, workflows: strList,
    entities: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['name', 'label', 'labelPlural', 'icon', 'description', 'labelField', 'fields', 'permissions'],
      properties: {
        name: str, label: str, labelPlural: str, icon: str, description: str, labelField: str,
        permissions: { type: 'object', additionalProperties: false, required: ['read', 'create', 'update', 'delete'], properties: { read: strList, create: strList, update: strList, delete: strList } },
        fields: { type: 'array', items: { type: 'object', additionalProperties: false,
          required: ['name', 'label', 'type', 'required', 'unique', 'searchable', 'options', 'refEntity', 'format'],
          properties: {
            name: str, label: str, type: { type: 'string', enum: ['string', 'text', 'int', 'decimal', 'boolean', 'date', 'datetime', 'enum', 'ref'] },
            required: { type: 'boolean' }, unique: { type: 'boolean' }, searchable: { type: 'boolean' }, options: strList,
            refEntity: str, format: { type: 'string', enum: ['', 'email', 'url', 'phone', 'money'] },
          } } },
      } } },
    pages: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['slug', 'title', 'route', 'kind', 'entity', 'description', 'access', 'inMenu', 'icon'],
      properties: { slug: str, title: str, route: str, kind: { type: 'string', enum: ['home', 'dashboard', 'list'] }, entity: str, description: str, access: { type: 'string', enum: ['public', 'authenticated'] }, inMenu: { type: 'boolean' }, icon: str } } },
    sampleData: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['entity', 'records'],
      properties: { entity: str, records: { type: 'array', items: { type: 'object', additionalProperties: { type: 'string' } } } } } },
  },
} as const;

const FIELD_TYPES = new Set<SpecFieldType>(['string', 'text', 'int', 'decimal', 'boolean', 'date', 'datetime', 'enum', 'ref']);
const FORMATS = new Set(['email', 'url', 'phone', 'money']);
const strings = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : value == null ? fallback : String(value);

/**
 * Models drift from the schema (missing keys, nulls, odd types). Fill safe defaults so
 * shape errors never reach the user; real design problems are left for validateSpec.
 */
export function normalizeSpec(raw: any): AppSpec {
  const spec = raw && typeof raw === 'object' ? raw : {};
  return {
    name: text(spec.name, 'App'), summary: text(spec.summary), roles: strings(spec.roles), workflows: strings(spec.workflows),
    entities: (Array.isArray(spec.entities) ? spec.entities : []).map((entity: any) => {
      const fields: SpecField[] = (Array.isArray(entity?.fields) ? entity.fields : []).map((field: any) => {
        const type = FIELD_TYPES.has(field?.type) ? field.type as SpecFieldType : 'string';
        return {
          name: text(field?.name), label: text(field?.label, text(field?.name)), type,
          required: Boolean(field?.required), unique: Boolean(field?.unique), searchable: Boolean(field?.searchable),
          options: type === 'enum' ? strings(field?.options) : [], refEntity: type === 'ref' ? text(field?.refEntity) : '',
          format: FORMATS.has(field?.format) ? field.format : '',
        };
      });
      const permissions = entity?.permissions ?? {};
      return {
        name: text(entity?.name), label: text(entity?.label, text(entity?.name)), labelPlural: text(entity?.labelPlural, text(entity?.label, text(entity?.name))),
        icon: text(entity?.icon), description: text(entity?.description), labelField: text(entity?.labelField, fields[0]?.name ?? ''), fields,
        permissions: { read: strings(permissions.read), create: strings(permissions.create), update: strings(permissions.update), delete: strings(permissions.delete) },
      };
    }),
    pages: (Array.isArray(spec.pages) ? spec.pages : []).map((page: any) => ({
      slug: text(page?.slug, text(page?.route).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'), title: text(page?.title, text(page?.slug)), route: text(page?.route, '/'),
      kind: ['home', 'dashboard', 'list'].includes(page?.kind) ? page.kind : 'list', entity: text(page?.entity), description: text(page?.description),
      access: page?.access === 'public' ? 'public' : 'authenticated', inMenu: page?.inMenu !== false, icon: text(page?.icon),
    })),
    sampleData: (Array.isArray(spec.sampleData) ? spec.sampleData : []).map((sample: any) => ({
      entity: text(sample?.entity),
      records: sampleRecords(sample?.records),
    })),
  };
}

/** Accepts every record shape models produce: {field: value} maps, [{field, value}] pairs, or a flat list of pairs. */
function sampleRecords(raw: unknown): Array<Array<{ field: string; value: string }>> {
  const list = Array.isArray(raw) ? raw : [];
  const isPair = (item: any) => item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).sort().join() === 'field,value';
  if (list.length && list.every(isPair)) return [list.map((pair: any) => ({ field: text(pair.field), value: text(pair.value) }))];
  return list.map((record: any) => Array.isArray(record)
    ? record.filter(isPair).map((pair: any) => ({ field: text(pair.field), value: text(pair.value) }))
    : Object.entries(record ?? {}).map(([field, value]) => ({ field, value: text(value) })));
}

const camel = (value: string) => value.trim().replace(/[^a-zA-Z0-9]+(.)?/g, (_, next: string | undefined) => (next ?? '').toUpperCase()).replace(/^[A-Z]/, (char) => char.toLowerCase()).replace(/^[^a-z]+/, '') || 'field';
const snake = (value: string) => value.trim().replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[^a-z]+/, '') || 'record';
const kebab = (value: string) => snake(value).replaceAll('_', '-');

/**
 * Deterministic repairs for mistakes models make constantly, applied before validation so
 * they never cost an AI round (the free tier allows roughly one spec generation a minute).
 */
export function autoRepair(input: AppSpec): { spec: AppSpec; repairs: string[] } {
  const spec: AppSpec = structuredClone(input);
  const repairs: string[] = [];
  const renamedEntities = new Map<string, string>();
  for (const entity of spec.entities) {
    let name = snake(entity.name);
    if (RESERVED_ENTITY_NAMES.has(name)) name = `${name.replace(/s$/, '')}_record`;
    if (name !== entity.name) { renamedEntities.set(entity.name, name); repairs.push(`Renamed entity "${entity.name}" to "${name}"`); entity.name = name; }
    const renamedFields = new Map<string, string>();
    entity.fields = entity.fields.filter((field) => {
      if (SYSTEM_FIELDS.has(field.name) || SYSTEM_FIELDS.has(camel(field.name))) { repairs.push(`Removed system field ${entity.name}.${field.name}`); return false; }
      return true;
    });
    for (const field of entity.fields) {
      const fixed = camel(field.name);
      if (fixed !== field.name) { renamedFields.set(field.name, fixed); field.name = fixed; }
      if (field.type === 'enum' && field.options.length < 2) { field.type = 'string'; field.options = []; repairs.push(`${entity.name}.${field.name}: enum without options became text`); }
    }
    const seen = new Set<string>();
    entity.fields = entity.fields.filter((field) => !seen.has(field.name) && Boolean(seen.add(field.name)));
    if (renamedFields.size) repairs.push(`Renamed ${renamedFields.size} field(s) of ${entity.name} to camelCase`);
    entity.labelField = renamedFields.get(entity.labelField) ?? entity.labelField;
    if (!entity.fields.some((field) => field.name === entity.labelField)) {
      entity.labelField = (entity.fields.find((field) => field.type === 'string') ?? entity.fields[0])?.name ?? entity.labelField;
    }
    for (const sample of spec.sampleData) if (sample.entity === entity.name || renamedEntities.get(sample.entity) === entity.name) {
      sample.entity = entity.name;
      sample.records = sample.records.map((record) => record.map((pair) => ({ ...pair, field: renamedFields.get(pair.field) ?? camel(pair.field) })).filter((pair) => seen.has(pair.field)));
    }
  }
  const names = new Set(spec.entities.map((entity) => entity.name));
  for (const entity of spec.entities) for (const field of entity.fields) {
    if (field.type !== 'ref') continue;
    field.refEntity = renamedEntities.get(field.refEntity) ?? snake(field.refEntity);
    if (!names.has(field.refEntity)) { repairs.push(`${entity.name}.${field.name}: link to unknown "${field.refEntity}" became text`); field.type = 'string'; field.refEntity = ''; }
  }
  spec.sampleData = spec.sampleData.filter((sample) => names.has(sample.entity));
  for (const page of spec.pages) {
    if (page.entity) page.entity = renamedEntities.get(page.entity) ?? page.entity;
    page.route = page.route.startsWith('/')
      ? page.route.toLowerCase().replace(/\/:[a-z]+/gi, '').replace(/[^a-z0-9\-/]/g, '-').replace(/\/+$/, '') || '/'
      : `/${kebab(page.route)}`;
  }
  spec.pages = spec.pages.filter((page) => !(page.kind === 'list' && !names.has(page.entity)) && !page.route.startsWith('/api') && page.route !== '/login');
  const routes = new Set<string>();
  for (const page of spec.pages) { while (routes.has(page.route)) page.route = `${page.route}-2`; routes.add(page.route); }
  for (const entity of spec.entities) {
    if (spec.pages.some((page) => page.kind === 'list' && page.entity === entity.name)) continue;
    let route = `/${kebab(entity.labelPlural || entity.name)}`;
    while (routes.has(route)) route = `${route}-list`;
    routes.add(route);
    spec.pages.push({ slug: route.slice(1), title: entity.labelPlural || entity.label, route, kind: 'list', entity: entity.name, description: `Manage ${(entity.labelPlural || entity.label).toLowerCase()}`, access: 'authenticated', inMenu: true, icon: entity.icon });
    repairs.push(`Added a list page for ${entity.label}`);
  }
  return { spec, repairs };
}

const ENTITY_NAME = /^[a-z][a-z0-9_]{1,40}$/;
const FIELD_NAME = /^[a-z][a-zA-Z0-9]{0,40}$/;
const SYSTEM_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt']);

/** Deterministic checks the developer agent must satisfy before anything runs. */
export function validateSpec(spec: AppSpec): string[] {
  const issues: string[] = [];
  const entityNames = new Set<string>();
  if (!spec.entities.length) issues.push('The app needs at least one entity.');
  for (const entity of spec.entities) {
    const where = `Entity "${entity.name}"`;
    if (!ENTITY_NAME.test(entity.name)) issues.push(`${where}: name must be snake_case (a-z, 0-9, _).`);
    if (RESERVED_ENTITY_NAMES.has(entity.name)) issues.push(`${where}: "${entity.name}" is reserved by Mosaic; use a business name such as "member" or "staff".`);
    if (entityNames.has(entity.name)) issues.push(`${where}: duplicate entity name.`);
    entityNames.add(entity.name);
    const fieldNames = new Set<string>();
    if (!entity.fields.length) issues.push(`${where}: needs at least one field.`);
    for (const field of entity.fields) {
      const at = `${where}.${field.name}`;
      if (!FIELD_NAME.test(field.name)) issues.push(`${at}: field names must be camelCase letters/digits.`);
      if (SYSTEM_FIELDS.has(field.name)) issues.push(`${at}: "${field.name}" is a system column Mosaic adds automatically; remove it.`);
      if (fieldNames.has(field.name)) issues.push(`${at}: duplicate field.`);
      fieldNames.add(field.name);
      if (field.type === 'enum' && field.options.length < 2) issues.push(`${at}: enum fields need at least 2 options.`);
      if (field.type === 'ref' && !field.refEntity) issues.push(`${at}: ref fields need refEntity.`);
    }
    if (!fieldNames.has(entity.labelField)) issues.push(`${where}: labelField "${entity.labelField}" is not one of its fields.`);
  }
  for (const entity of spec.entities) for (const field of entity.fields) {
    if (field.type === 'ref' && field.refEntity && !entityNames.has(field.refEntity)) issues.push(`Entity "${entity.name}".${field.name}: refEntity "${field.refEntity}" does not exist.`);
  }
  const routes = new Set<string>();
  for (const page of spec.pages) {
    if (!/^\/[a-z0-9\-/]*$/.test(page.route)) issues.push(`Page "${page.slug}": route must look like /path (lowercase, no params).`);
    if (page.route.startsWith('/api') || page.route === '/login') issues.push(`Page "${page.slug}": route ${page.route} is reserved.`);
    if (routes.has(page.route)) issues.push(`Page "${page.slug}": duplicate route ${page.route}.`);
    routes.add(page.route);
    if (page.kind === 'list' && (!page.entity || !entityNames.has(page.entity))) issues.push(`Page "${page.slug}": list pages need an existing entity.`);
  }
  for (const entity of spec.entities) {
    if (!spec.pages.some((page) => page.kind === 'list' && page.entity === entity.name)) issues.push(`Entity "${entity.name}" has no list page, so users cannot manage its records.`);
  }
  for (const sample of spec.sampleData) {
    const entity = spec.entities.find((item) => item.name === sample.entity);
    if (!entity) { issues.push(`Sample data for unknown entity "${sample.entity}".`); continue; }
    for (const record of sample.records) for (const { field } of record) {
      if (!entity.fields.some((item) => item.name === field)) issues.push(`Sample data for "${entity.name}" uses unknown field "${field}".`);
    }
  }
  return issues;
}

/** Turns a sample value string into the field's JSON type; refs are resolved later by label. */
export function coerceSample(field: SpecField, value: string): unknown {
  if (value === '') return null;
  if (field.type === 'int') return Number.parseInt(value, 10);
  if (field.type === 'decimal') return Number.parseFloat(value);
  if (field.type === 'boolean') return /^(true|yes|1)$/i.test(value);
  return value;
}

function fieldDef(field: SpecField): FieldDef {
  const def: FieldDef = { name: field.name, label: field.label, type: field.type, required: field.required || undefined, unique: field.unique || undefined, searchable: field.searchable || undefined };
  if (field.type === 'enum') def.options = field.options.map((value) => ({ value: value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || value, label: value }));
  if (field.type === 'ref') def.refEntity = field.refEntity!;
  if (field.format) def.format = field.format;
  return def;
}

function formNode(field: SpecField, id: string): FormNode {
  const props: Record<string, unknown> = { label: field.label, binding: field.name, required: field.required || undefined };
  switch (field.type) {
    case 'text': return { id, type: 'textArea', props: { ...props, rows: 4, colSpan: 2 } };
    case 'int': return { id, type: 'numberField', props };
    case 'decimal': return { id, type: field.format === 'money' ? 'currencyField' : 'numberField', props };
    case 'boolean': return { id, type: 'switch', props };
    case 'date': case 'datetime': return { id, type: 'datePicker', props };
    case 'enum': return { id, type: 'selectField', props: { ...props, options: fieldDef(field).options } };
    case 'ref': return { id, type: 'refSelect', props: { ...props, entity: field.refEntity } };
    default: return { id, type: 'textField', props: { ...props, format: field.format || undefined } };
  }
}

export interface CompiledApp { entities: EntityDef[]; forms: FormDef[]; pages: PageDef[] }

export function compileSpec(spec: AppSpec): CompiledApp {
  const entities: EntityDef[] = spec.entities.map((entity) => ({
    name: entity.name, label: entity.label, labelPlural: entity.labelPlural, icon: entity.icon || undefined, description: entity.description,
    softDelete: true, timestamps: true, audit: true,
    permissions: Object.fromEntries(Object.entries(entity.permissions).map(([action, roles]) => [action, roles.length ? roles : ['*']])),
    list: { defaultSort: '-createdAt', labelField: entity.labelField, columns: entity.fields.filter((field) => field.type !== 'text').slice(0, 6).map((field) => field.name), searchFields: entity.fields.filter((field) => field.searchable).map((field) => field.name) },
    fields: entity.fields.map(fieldDef),
  }));
  const forms: FormDef[] = spec.entities.map((entity) => ({
    id: `frm_${entity.name}`, slug: `${entity.name.replaceAll('_', '-')}-form`, name: `${entity.label} form`, description: `Create or edit a ${entity.label.toLowerCase()}`,
    entity: entity.name, version: 1, published: true, dataSource: { kind: 'entity', entity: entity.name },
    settings: { layout: 'vertical', columns: 2, submitLabel: `Save ${entity.label.toLowerCase()}`, successMessage: `${entity.label} saved` },
    root: { id: `frm_${entity.name}_root`, type: 'form', children: [{ id: `frm_${entity.name}_grid`, type: 'grid', props: { columns: 2, gap: 'md' }, children: entity.fields.map((field, index) => formNode(field, `f_${entity.name}_${index}`)) }] },
  } as FormDef));
  const byName = new Map(spec.entities.map((entity) => [entity.name, entity]));
  const pages: PageDef[] = spec.pages.map((page, order) => {
    const id = `pg_${page.slug.replace(/[^a-z0-9]+/gi, '_')}`;
    const children: FormNode[] = [{ id: `${id}_title`, type: 'heading', props: { text: page.title, level: 1 } }];
    if (page.description && page.kind !== 'list') children.push({ id: `${id}_intro`, type: 'text', props: { text: page.description, size: 'lg', muted: true } });
    if (page.kind === 'list' && page.entity) {
      const entity = byName.get(page.entity)!;
      children.push({ id: `${id}_table`, type: 'entityTable', props: { entity: entity.name, title: entity.labelPlural, columns: entities.find((item) => item.name === entity.name)!.list!.columns, pageSize: 20, sortable: true, searchable: true, allowCreate: true, allowEdit: true, allowDelete: true, drillDown: true } });
    } else if (page.kind === 'dashboard' || page.kind === 'home') {
      children.push({ id: `${id}_stats`, type: 'statRow', props: {}, children: spec.entities.slice(0, 4).map((entity, index) => ({ id: `${id}_stat${index}`, type: 'statCard', props: { label: entity.labelPlural, entity: entity.name } })) });
      const focus = page.entity ? byName.get(page.entity) : spec.entities[0];
      if (focus && page.access === 'authenticated') children.push({ id: `${id}_recent`, type: 'entityTable', props: { entity: focus.name, title: `Recent ${focus.labelPlural.toLowerCase()}`, pageSize: 8, sortable: true, searchable: true, allowCreate: true, allowEdit: true, allowDelete: false, drillDown: true } });
    }
    return {
      id, slug: page.slug, route: page.route, name: page.title, description: page.description, version: 1, published: true,
      settings: { title: page.title, requiresAuth: page.access === 'authenticated', menu: { show: page.inMenu, order: order + 1, icon: page.icon || undefined } },
      root: { id: `${id}_root`, type: 'page', children },
    } as PageDef;
  });
  return { entities, forms, pages };
}

/** The older blueprint shape the builder UI and preview already render. */
export function blueprintFromSpec(spec: AppSpec) {
  return {
    summary: spec.summary,
    routes: spec.pages.map((page) => ({ path: page.route, purpose: page.description || page.title, access: page.access })),
    entities: spec.entities.map((entity) => ({ name: entity.label, purpose: entity.description, fields: entity.fields.map((field) => `${field.name}:${field.type}`) })),
    roles: spec.roles, workflows: spec.workflows, implementationNotes: [] as string[],
  };
}

/** One-line summary per entity/page for the reviewer (keeps prompts small on the 8k-token budget). */
export function describeSpec(spec: AppSpec): string {
  const entities = spec.entities.map((entity) => `- ${entity.name} (${entity.label}): ${entity.fields.map((field) => `${field.name}:${field.type}${field.type === 'ref' ? `→${field.refEntity}` : ''}${field.type === 'enum' ? `[${field.options.join('|')}]` : ''}${field.required ? '*' : ''}`).join(', ')}; perms create=${entity.permissions.create.join('/') || '*'} delete=${entity.permissions.delete.join('/') || '*'}`).join('\n');
  const pages = spec.pages.map((page) => `- ${page.route} ${page.kind}${page.entity ? `(${page.entity})` : ''} ${page.access}${page.inMenu ? ' menu' : ''}`).join('\n');
  const samples = spec.sampleData.map((sample) => `${sample.entity}×${sample.records.length}`).join(', ');
  return `Roles: ${spec.roles.join(', ')}\nEntities:\n${entities}\nPages (list pages give full create/edit/delete/detail):\n${pages}\nSample data: ${samples || 'none'}\nWorkflows: ${spec.workflows.join('; ')}`;
}
