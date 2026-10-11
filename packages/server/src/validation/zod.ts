/** Build Zod validation schemas from entity metadata. */

import { enumOptions, systemFields, type EntityDef, type FieldDef } from '@mosaic-apps/core';
import { z } from 'zod';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stringSchema(field: FieldDef): z.ZodType {
  let schema = z.string();
  if (field.minLength !== undefined) schema = schema.min(field.minLength);
  if (field.maxLength !== undefined) schema = schema.max(field.maxLength);
  const max = field.type === 'string' ? (field.length ?? 255) : 100_000;
  schema = schema.max(max);
  if (field.format === 'email') {
    return schema.refine((v) => EMAIL_RE.test(v), { message: 'Must be a valid email address' });
  }
  if (field.format === 'url') {
    return schema.refine((v) => /^https?:\/\/\S+$/.test(v), { message: 'Must be a valid URL' });
  }
  if (field.format === 'slug') {
    return schema.regex(/^[a-z0-9][a-z0-9-_]*$/i, 'Must be a slug (letters, numbers, dashes)');
  }
  if (field.format === 'phone') {
    return schema.regex(/^\+?[0-9 ()\-]{5,32}$/, 'Must be a phone number');
  }
  if (field.format === 'color') {
    return schema.regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'Must be a hex color (#fff)');
  }
  return schema;
}

function baseSchema(field: FieldDef): z.ZodType {
  switch (field.type) {
    case 'string':
    case 'text':
    case 'file':
      return stringSchema(field);
    case 'id':
      return z.string().regex(UUID_RE, 'Must be a UUID');
    case 'ref':
      return z.string().regex(UUID_RE, 'Must be a valid record id');
    case 'int': {
      let n = z.coerce.number().int('Must be a whole number');
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      return n;
    }
    case 'decimal': {
      let n = z.coerce.number();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      return n;
    }
    case 'boolean':
      return z.preprocess(
        (v) => {
          if (typeof v === 'string') return v === 'true' || v === '1';
          if (typeof v === 'number') return v !== 0;
          return v;
        },
        z.boolean(),
      );
    case 'date':
      return z.string().refine((v) => DATE_RE.test(v), { message: 'Use format YYYY-MM-DD' });
    case 'datetime':
      return z
        .string()
        .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Must be an ISO date-time' })
        .transform((v) => new Date(v).toISOString());
    case 'enum': {
      const values = enumOptions(field).map((o) => o.value);
      if (!values.length) return z.string();
      return z.string().refine((v) => values.includes(v), {
        message: `Must be one of: ${values.join(', ')}`,
      });
    }
    case 'json':
      return z.unknown();
    default:
      return z.unknown();
  }
}

function withNullability(field: FieldDef, schema: z.ZodType, mode: 'create' | 'update'): z.ZodType {
  const required = mode === 'create' ? Boolean(field.required) : false;
  if (field.type === 'json') {
    return required ? schema : (schema as z.ZodOptional<z.ZodType>).optional?.() ?? schema;
  }
  let out = schema;
  if (!required) {
    out = out.nullable().optional() as z.ZodType;
  } else if (field.default !== undefined) {
    out = out.optional() as z.ZodType;
  }
  return out;
}

/** Zod object schema for validating create/update payloads. */
export function buildEntitySchema(entity: EntityDef, mode: 'create' | 'update'): z.ZodType {
  const writable = entity.fields.filter((f) => !f.readonly && !f.system);
  const shape: Record<string, z.ZodType> = {};
  for (const field of writable) {
    shape[field.name] = withNullability(field, baseSchema(field), mode);
  }
  // system fields never accepted from clients
  for (const sys of systemFields(entity)) delete shape[sys.name];
  return z.object(shape) as z.ZodType;
}

export interface Issue {
  path: string;
  message: string;
}

export function formatIssues(err: z.ZodError): Issue[] {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

