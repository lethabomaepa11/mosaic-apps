<script lang="ts">
  /**
   * EntityForm - auto-generates a CRUD form from entity metadata (Shesha-style
   * "tick a box" experience): every writable field becomes the right input,
   * submit hits the auto-generated CRUD endpoint.
   */

  import { allFields, enumOptions, newId, type EntityDef, type FormDef } from '@mosaic-apps/core';
  import type { MosaicClient } from '../client/api';
  import FormRenderer from './FormRenderer.svelte';

  interface Props {
    entity: EntityDef;
    client: MosaicClient;
    record?: Record<string, unknown>;
    mode?: 'create' | 'edit' | 'view';
    columns?: number;
    hideSystemFields?: boolean;
    onsaved?: (record: Record<string, unknown>) => void;
    oncancel?: () => void;
    submitLabel?: string;
  }

  let { entity, client, record, mode = 'create', columns = 2, hideSystemFields = true, onsaved, oncancel, submitLabel }: Props = $props();

  const fields = $derived(allFields(entity).filter((f) => {
    if (!f.system) return true;
    return !hideSystemFields && f.type !== 'id';
  }));

  function widgetFor(type: string, field: { options?: unknown; refEntity?: string; format?: string }): { type: string; extra?: Record<string, unknown> } {
    switch (type) {
      case 'string':
        return { type: 'textField', extra: field.format && field.format !== 'text' ? { format: field.format } : undefined };
      case 'text':
        return { type: 'textArea' };
      case 'int':
        return { type: 'numberField', extra: { step: 1 } };
      case 'decimal':
        return { type: 'currencyField' };
      case 'boolean':
        return { type: 'switch' };
      case 'enum':
        return { type: 'selectField' };
      case 'date':
        return { type: 'datePicker' };
      case 'datetime':
        return { type: 'timePicker' };
      case 'ref':
        return { type: 'refSelect', extra: { entity: field.refEntity } };
      case 'json':
        return { type: 'jsonEditor' };
      case 'file':
        return { type: 'fileUpload' };
      default:
        return { type: 'textField' };
    }
  }

  const generatedForm = $derived.by((): FormDef => {
    const children = fields.map((f) => {
      const { type, extra } = widgetFor(f.type, f);
      const props: Record<string, unknown> = {
        label: f.label ?? f.name,
        binding: f.name,
        required: Boolean(f.required),
        helpText: f.ui?.helpText ?? f.description,
        disabled: f.readonly,
        ...extra,
      };
      if (f.type === 'enum' && f.options) props.options = enumOptions(f);
      if (f.type === 'int' || f.type === 'decimal') {
        if (f.min !== undefined) props.min = f.min;
        if (f.max !== undefined) props.max = f.max;
      }
      return { id: newId('c'), type, props };
    });
    return {
      id: 'entity-form',
      slug: 'entity-form',
      name: `${entity.label ?? entity.name} form`,
      version: 1,
      published: true,
      entity: entity.name,
      root: {
        id: 'ef_root',
        type: 'form',
        children: [
          {
            id: 'ef_grid',
            type: 'grid',
            props: { columns, gap: 'md' },
            children,
          },
        ],
      },
      settings: { layout: 'vertical', submitLabel: submitLabel ?? (mode === 'create' ? 'Create' : 'Save') },
    } as FormDef;
  });
</script>

{#if oncancel}
  <div class="m-row" style="justify-content:flex-end;margin-bottom:var(--m-space-3)">
    <button class="m-btn m-btn--ghost" onclick={oncancel}>Cancel</button>
  </div>
{/if}
<FormRenderer
  form={generatedForm}
  {record}
  {mode}
  {client}
  entity={entity}
  onsaved={onsaved}
/>
