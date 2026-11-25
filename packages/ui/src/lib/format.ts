import { enumOptions, type FieldDef } from '@mosaic-apps/core';

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
    case 'datetime': {
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) return String(v);
      // date values are calendar days stored at UTC midnight; formatting in local time would shift the day west of UTC
      return field.type === 'date'
        ? d.toLocaleDateString(locale, { dateStyle: 'medium', timeZone: 'UTC' })
        : d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
    }
  }
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}
