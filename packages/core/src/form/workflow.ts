/** Generate editable, linked business views from one entity definition. */
import { allFields, enumOptions, entityLabelPlural, type EntityDef, type FieldDef } from '../types/entity.js';
import { type FormDef, type FormNode } from '../types/form.js';
import { type PageDef } from '../types/page.js';
import { newId, slugify } from '../ids.js';

export interface EntityWorkflowOptions {
  name?: string;
  slug?: string;
  folder?: string;
  columns?: string[];
  fields?: string[];
  pageSize?: number;
}

export interface EntityWorkflow {
  entity: string;
  page: PageDef;
  forms: { create: FormDef; edit: FormDef; detail: FormDef };
}

const widgets: Record<FieldDef['type'], string> = {
  id: 'textField', string: 'textField', text: 'textArea', int: 'numberField',
  decimal: 'currencyField', boolean: 'switch', date: 'datePicker', datetime: 'timePicker',
  enum: 'selectField', json: 'jsonEditor', ref: 'refSelect', file: 'fileUpload',
};

function fieldNode(field: FieldDef, prefix: string): FormNode {
  const props: Record<string, unknown> = {
    label: field.label ?? field.name, binding: field.name, required: !!field.required,
    disabled: !!field.readonly, helpText: field.ui?.helpText ?? field.description,
  };
  for (const key of ['default', 'min', 'max', 'minLength', 'maxLength', 'format'] as const) {
    if (field[key] !== undefined) props[key] = field[key];
  }
  if (field.ui?.placeholder) props.placeholder = field.ui.placeholder;
  if (field.type === 'enum') props.options = enumOptions(field);
  if (field.type === 'ref') props.entity = field.refEntity;
  if (field.type === 'int') props.step = 1;
  if (field.type === 'datetime') props.withTime = true;
  return { id: `${prefix}_${field.name}`, type: field.ui?.widget ?? widgets[field.type], props };
}

export function generateEntityWorkflow(entity: EntityDef, options: EntityWorkflowOptions = {}): EntityWorkflow {
  for (const key of ['name', 'slug', 'folder'] as const) {
    if (options[key] !== undefined && (typeof options[key] !== 'string' || options[key]!.length > 160)) throw new Error(`${key} must be a string up to 160 characters.`);
  }
  if (options.pageSize !== undefined && (!Number.isInteger(options.pageSize) || options.pageSize < 5 || options.pageSize > 100)) throw new Error('Page size must be between 5 and 100.');
  const all = allFields(entity);
  const byName = new Map(all.map((field) => [field.name, field]));
  for (const [key, values] of [['columns', options.columns], ['fields', options.fields]] as const) {
    if (values !== undefined && (!Array.isArray(values) || values.length > 200 || values.some((value) => typeof value !== 'string' || !byName.has(value)))) {
      throw new Error(`${key} must contain available entity field names.`);
    }
  }
  const writable = entity.fields.filter((field) => !field.readonly && !field.system && !field.ui?.hidden);
  const chosen = options.fields === undefined ? writable : writable.filter((field) => options.fields!.includes(field.name));
  const omitted = entity.fields.find((field) => !field.readonly && !field.system && field.required && field.default === undefined && !chosen.includes(field));
  if (omitted) throw new Error(`Required field ${omitted.label ?? omitted.name} cannot be omitted.`);
  if (!chosen.length) throw new Error('Choose at least one writable field.');
  const columns = [...new Set(options.columns?.length ? options.columns : entity.list?.columns?.length ? entity.list.columns : chosen.slice(0, 6).map((field) => field.name))];
  if (columns.some((column) => !byName.has(column))) throw new Error('Default entity columns reference unavailable fields.');
  const label = entity.label ?? entity.name;
  const name = options.name?.trim() || entityLabelPlural(entity);
  const slug = slugify(options.slug?.trim() || name);
  const folder = options.folder?.trim() || name;
  const pageId = newId('pg');
  const definitions = {} as EntityWorkflow['forms'];
  for (const mode of ['create', 'edit', 'detail'] as const) {
    const id = newId('frm');
    const title = `${mode === 'create' ? 'Create' : mode === 'edit' ? 'Edit' : 'View'} ${label}`;
    const fields = mode === 'detail' ? all.filter((field) => !field.ui?.hidden) : chosen;
    definitions[mode] = {
      id, name: title, slug: `${slug}-${mode}`, folder, entity: entity.name,
      version: 1, published: true,
      dataSource: mode === 'create' ? { kind: 'none' } : { kind: 'entity', entity: entity.name, recordId: '$query.id' },
      root: { id: `${id}_root`, type: 'form', children: [
        { id: `${id}_back`, type: 'button', props: { label: `Back to ${name}`, variant: 'ghost', colSpan: 2, actions: [{ type: 'navigate', target: 'url', to: `/p/${slug}` }] } },
        ...fields.map((field) => fieldNode(field, id)),
      ] },
      settings: {
        mode: mode === 'detail' ? 'view' : mode,
        columns: 2, layout: 'vertical', submitLabel: mode === 'create' ? `Create ${label}` : 'Save changes',
        successMessage: mode === 'create' ? `${label} created` : `${label} updated`,
        redirectAfterSubmit: `/p/${slug}`, showReset: mode === 'create',
        seo: { title, robots: 'noindex,nofollow' },
      },
    };
  }
  const page: PageDef = {
    id: pageId, name, slug, route: `/p/${slug}`, folder, version: 1, published: true,
    settings: { title: name, requiresAuth: true, menu: { show: true, icon: entity.icon ?? 'database' }, seo: { title: name, robots: 'noindex,nofollow' } },
    root: { id: `${pageId}_root`, type: 'page', children: [{
      id: `${pageId}_table`, type: 'entityTable', props: {
        entity: entity.name, title: name, columns, pageSize: Math.max(5, Math.min(100, Math.trunc(options.pageSize ?? entity.list?.pageSize ?? 20))),
        searchable: true, sortable: true, allowCreate: true, allowEdit: true, allowDelete: true, drillDown: true,
        createFormId: definitions.create.id, editFormId: definitions.edit.id, detailFormId: definitions.detail.id,
      },
    }] },
  };
  return { entity: entity.name, forms: definitions, page };
}
