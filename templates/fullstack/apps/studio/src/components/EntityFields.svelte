<script lang="ts">
  import type { EntityDef, FieldDef, FieldType, EnumOption } from '@mosaic-apps/core';
  import { Checkbox, Icon, SelectField, ShadcnInput } from '@mosaic-apps/ui';
  import { client } from '#lib/client';

  interface Props {
    entity: EntityDef;
    onchange: (entity: EntityDef) => void;
  }

  let { entity, onchange }: Props = $props();

  const FIELD_TYPES: FieldType[] = ['string', 'text', 'int', 'decimal', 'boolean', 'date', 'datetime', 'enum', 'json', 'ref', 'file'];
  let entities = $state<{ name: string; label: string }[]>([]);

  async function loadEntities() {
    try {
      const res = await client.listEntities();
      entities = res.map((e) => ({ name: e.definition.name, label: e.definition.label ?? e.definition.name }));
    } catch { /* ignore */ }
  }

  $effect(() => {
    loadEntities();
  });

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
          <td><ShadcnInput class="m-input" ariaLabel={`Field ${i + 1} name`} value={field.name} onchange={(e) => updateField(i, { name: (e.currentTarget as HTMLInputElement).value })} /></td>
          <td><ShadcnInput class="m-input" ariaLabel={`Field ${i + 1} label`} value={field.label ?? ''} onchange={(e) => updateField(i, { label: (e.currentTarget as HTMLInputElement).value })} /></td>
          <td>
            <SelectField label={`Field ${i + 1} type`} value={field.type} clearable={false} options={FIELD_TYPES.map(type => ({ value:type, label:type }))} oninput={type => updateField(i, { type: type as FieldType })} />
          </td>
          <td>
            {#if field.type === 'enum'}
              <ShadcnInput class="m-input" ariaLabel={`Field ${i + 1} options`} placeholder="a,b,c" value={optionsOf(field).map((o) => o.value).join(',')}
                onchange={(e) => updateField(i, { options: (e.currentTarget as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean) })} />
            {:else if field.type === 'ref'}
              <SelectField
                value={field.refEntity}
                oninput={refEntity => updateField(i, { refEntity: refEntity ?? undefined })}
                placeholder="entity name"
                options={[{ value: '', label: '— select entity —' }, ...entities.map(e => ({ value: e.name, label: e.label }))]}
              />
            {:else}
              <span class="m-muted m-small">—</span>
            {/if}
          </td>
          <td style="white-space:nowrap">
            <Checkbox label="Required" value={field.required ?? false} oninput={required => updateField(i, { required })} />
            <Checkbox label="Unique" value={field.unique ?? false} oninput={unique => updateField(i, { unique })} />
            <Checkbox label="Indexed" value={field.indexed ?? false} oninput={indexed => updateField(i, { indexed })} />
          </td>
          <td><button class="m-btn m-btn--ghost m-btn--icon" aria-label="Remove field" onclick={() => removeField(i)}><Icon name="x" size={14} /></button></td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="m-row" style="margin-top:12px">
    <Checkbox label="Soft delete (deletedAt)" value={entity.softDelete ?? false} oninput={softDelete => emit({ ...entity, softDelete })} />
    <Checkbox label="Audit changes" value={entity.audit ?? true} oninput={audit => emit({ ...entity, audit })} />
  </div>
</section>

