import { enumOptions, type FieldDef } from '@mosaic-apps/core';
import moment from 'moment';

const localFormat = moment.HTML5_FMT.DATETIME_LOCAL;

export function localDatetimeValue(value: string | undefined): string {
  if (!value) return '';
  const date = moment(value, moment.ISO_8601, true);
  return date.isValid() ? date.format(localFormat) : '';
}

export function datetimeFromInput(value: string): string | undefined {
  const date = moment(value, localFormat, true);
  return date.isValid() && date.format(localFormat) === value ? date.toISOString() : undefined;
}

export function formatDate(value: unknown, type: 'date' | 'datetime', locale?: string): string {
  if (value == null || value === '') return '';
  const utc = type === 'date';
  const parse = utc ? moment.utc : moment;
  const date = value instanceof Date ? parse(value) : parse(String(value), moment.ISO_8601, true);
  if (!date.isValid()) return String(value);
  return locale ? date.toDate().toLocaleString(locale, utc ? { dateStyle: 'medium', timeZone: 'UTC' } : { dateStyle: 'medium', timeStyle: 'short' })
    : date.format(utc ? 'll' : 'll, LT');
}

/** Ref fields among `fields`, for a list request's `include` so rows carry `<field>_label`. */
export function refIncludes(fields: FieldDef[]): string[] {
  return fields.filter((f) => f.type === 'ref').map((f) => f.name);
}

/** Display text for one cell, driven by the entity field type. */
export function formatCell(field: FieldDef | undefined, row: Record<string, unknown>, locale?: string): string {
  const v = field ? row[field.name] : undefined;
  if (v === null || v === undefined || v === '') return '';
  switch (field?.type) {
    case 'ref': {
      const label = row[`${field.name}_label`];
      return label === null || label === undefined || label === '' ? String(v) : String(label);
    }
    case 'enum':
      return enumOptions(field).find((o) => o.value === v)?.label ?? String(v);
    case 'boolean':
      return v ? 'Yes' : 'No';
    case 'date':
    case 'datetime':
      return formatDate(v, field.type, locale);
  }
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}
