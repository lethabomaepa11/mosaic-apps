<script lang="ts">
  import type { EntityDef, FieldDef, FieldType, EnumOption } from '@mosaic/core';

  interface Props {
    entity: EntityDef;
    onchange: (entity: EntityDef) => void;
  }

  let { entity, onchange }: Props = $props();

  const FIELD_TYPES: FieldType[] = ['string', 'text', 'int', 'decimal', 'boolean', 'date', 'datetime', 'enum', 'json', 'ref', 'file'];

  function emit(next: EntityDef) {
    onchange(next);
  }

  function addField() {
    emit({ ...entity, fields: [...entity.fields, { name: `field${entity.fields.length + 1}`, label: 'New field', type: 'string' }] });
  }

  function removeField(i: number) {
    emit({ ...entity, fields: entity.fields.filter((_, idx) => idx !== i) });
  }

  function updateField(i: number, patch: Partial<FieldDef>) {
    const fields = [...entity.fields];
    fields[i] = { ...fields[i]!, ...patch };
    emit({ ...entity, fields });
  }

  function optionsOf(field: FieldDef): EnumOption[] {
    return (field.options ?? []).map((o) => (typeof o === 'string' ? { value: o } : o)) as EnumOption[];
  }
</script>

<section class="m-card" style="margin-bottom:18px">
  <header class="m-card__header">
    <strong>Fields ({entity.fields.length})</strong>
    <button class="m-btn m-btn--secondary m-btn--sm" onclick={addField}>+ Add field</button>
  </header>
  <table class="kv">
    <thead>
      <tr><th>Name</th><th>Label</th><th>Type</th><th>Options / ref</th><th>Flags</th><th></th></tr>
    </thead>
    <tbody>
      {#each entity.fields as field, i (i)}
        <tr>
          <td><input class="m-input" value={field.name} onchange={(e) => updateField(i, { name: (e.currentTarget as HTMLInputElement).value })} /></td>
          <td><input class="m-input" value={field.label ?? ''} onchange={(e) => updateField(i, { label: (e.currentTarget as HTMLInputElement).value })} /></td>
          <td>
            <select class="m-select" value={field.type} onchange={(e) => updateField(i, { type: (e.currentTarget as HTMLSelectElement).value as FieldType })}>
              {#each FIELD_TYPES as t (t)}<option value={t}>{t}</option>{/each}
            </select>
          </td>
          <td>
            {#if field.type === 'enum'}
              <input class="m-input" placeholder="a,b,c" value={optionsOf(field).map((o) => o.value).join(',')}
                onchange={(e) => updateField(i, { options: (e.currentTarget as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean) })} />
            {:else if field.type === 'ref'}
              <input class="m-input" placeholder="entity name" value={field.refEntity ?? ''}
                onchange={(e) => updateField(i, { refEntity: (e.currentTarget as HTMLInputElement).value })} />
            {:else}
              <span class="m-muted m-small">â€”</span>
            {/if}
          </td>
          <td style="white-space:nowrap">
            <label class="m-check"><input type="checkbox" checked={field.required ?? false} onchange={(e) => updateField(i, { required: (e.currentTarget as HTMLInputElement).checked })} /> req</label>
            <label class="m-check"><input type="checkbox" checked={field.unique ?? false} onchange={(e) => updateField(i, { unique: (e.currentTarget as HTMLInputElement).checked })} /> uniq</label>
            <label class="m-check"><input type="checkbox" checked={field.indexed ?? false} onchange={(e) => updateField(i, { indexed: (e.currentTarget as HTMLInputElement).checked })} /> idx</label>
          </td>
          <td><button class="m-btn m-btn--ghost m-btn--sm" onclick={() => removeField(i)}>âś•</button></td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="m-row" style="margin-top:12px">
    <label class="m-check"><input type="checkbox" checked={entity.softDelete ?? false} onchange={(e) => emit({ ...entity, softDelete: (e.currentTarget as HTMLInputElement).checked })} /> soft delete (deletedAt)</label>
    <label class="m-check"><input type="checkbox" checked={entity.audit ?? true} onchange={(e) => emit({ ...entity, audit: (e.currentTarget as HTMLInputElement).checked })} /> audit changes</label>
  </div>
</section>
