<script module lang="ts">
  import type { Snippet } from 'svelte';

  export interface Props<T extends Record<string, unknown>> {
    columns: { key: string; label: string; width?: string; align?: 'left' | 'right' | 'center'; render?: (row: T) => string; sortable?: boolean }[];
    rows?: T[];
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    onsort?: (key: string) => void;
    onrowclick?: (row: T) => void;
    emptyText?: string;
    actions?: Snippet<[T]>;
    /** Custom cell content (booleans keep the built-in check mark). */
    cell?: Snippet<[T, Props<T>['columns'][number]]>;
    loading?: boolean;
  }
</script>

<script lang="ts" generics="T extends Record<string, unknown>">
  import Icon from './Icon.svelte';
  import { formatDate } from '../lib/format';

  interface Column {
    key: string;
    label: string;
    width?: string;
    align?: 'left' | 'right' | 'center';
    render?: (row: T) => string;
    sortable?: boolean;
  }

  let { columns, rows = [], sortBy, sortDir, onsort, onrowclick, emptyText = 'No records', actions, cell, loading }: Props<T> = $props();

  function cellValue(row: T, col: Column): string {
    const v = row[col.key];
    if (col.render) return col.render(row);
    if (v === null || v === undefined) return '';
    if (v instanceof Date || ['createdAt', 'updatedAt', 'deletedAt'].includes(col.key)) {
      return formatDate(v, 'datetime');
    }
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function onRowClick(event: MouseEvent, row: T) {
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, [role="button"]')) return;
    onrowclick?.(row);
  }
</script>

<div class="m-table-wrap">
  <table class="m-table">
    <thead>
      <tr>
        {#each columns as col (col.key)}
          <th class:sortable={col.sortable && !!onsort} style={col.width ? `width:${col.width}` : ''}
            style:text-align={col.align ?? 'left'}
            aria-sort={sortBy === col.key ? (sortDir === 'desc' ? 'descending' : 'ascending') : undefined}>
            {#if col.sortable && onsort}
              <!-- a real button so sorting works from the keyboard -->
              <button type="button" class="m-table__sort" onclick={() => onsort(col.key)}>
                {col.label}{#if sortBy === col.key}<span aria-hidden="true" style="opacity:.6">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>{/if}
              </button>
            {:else}
              {col.label}{#if sortBy === col.key}<span aria-hidden="true" style="opacity:.6">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>{/if}
            {/if}
          </th>
        {/each}
        {#if actions}<th class="m-table__actions" aria-label="Actions"></th>{/if}
      </tr>
    </thead>
    <tbody>
      {#if loading}
        <tr><td colspan={columns.length + 1} class="m-table__empty"><span class="m-spinner"></span></td></tr>
      {:else if !rows.length}
        <tr><td colspan={columns.length + 1} class="m-table__empty">{emptyText}</td></tr>
      {:else}
        {#each rows as row, i (i)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
          <tr class:clickable={!!onrowclick} tabindex={onrowclick ? 0 : undefined}
            onclick={(event) => onRowClick(event, row)}
            onkeydown={(event) => {
              if (!onrowclick || event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
              event.preventDefault();
              onrowclick(row);
            }}>
            {#each columns as col (col.key)}
              <td style:text-align={col.align ?? 'left'} title={typeof row[col.key] === 'boolean' ? undefined : cellValue(row, col) || undefined}>
                {#if typeof row[col.key] === 'boolean'}
                  {#if row[col.key]}<Icon name="check" size={14} />{:else}—{/if}
                {:else if cell}
                  {@render cell(row, col)}
                {:else}
                  {cellValue(row, col)}
                {/if}
              </td>
            {/each}
            {#if actions}<td class="m-table__actions">{@render actions(row)}</td>{/if}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

<style>
  .clickable { cursor: pointer; }
  .clickable:focus-visible { outline: 2px solid var(--m-primary); outline-offset: -2px; }
</style>
