<script module lang="ts">
  import type { Snippet } from 'svelte';

  export interface Props<T extends Record<string, unknown>> {
    columns: { key: string; label: string; width?: string; align?: 'left' | 'right' | 'center'; render?: (row: T) => string; sortable?: boolean }[];
    rows: T[];
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    onsort?: (key: string) => void;
    onrowclick?: (row: T) => void;
    emptyText?: string;
    actions?: Snippet<[T]>;
    loading?: boolean;
  }
</script>

<script lang="ts" generics="T extends Record<string, unknown>">
  import Icon from './Icon.svelte';
  import { readDataPath } from '../state/data-source';

  interface Column {
    key: string;
    label: string;
    width?: string;
    align?: 'left' | 'right' | 'center';
    render?: (row: T) => string;
    sortable?: boolean;
  }

  let { columns, rows, sortBy, sortDir, onsort, onrowclick, emptyText = 'No records', actions, loading }: Props<T> = $props();

  function cellValue(row: T, col: Column): string {
    const v = Object.hasOwn(row, col.key) ? row[col.key] : readDataPath(row, col.key);
    if (col.render) return col.render(row);
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    if (col.key === 'createdAt' || col.key === 'updatedAt') {
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
    }
    return String(v);
  }

  function onRowClick(event: MouseEvent, row: T) {
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, select, textarea, [role="button"], [role="combobox"]')) return;
    onrowclick?.(row);
  }
</script>

<div class="m-table-wrap">
  <table class="m-table">
    <thead>
      <tr>
        {#each columns as col (col.key)}
          <th scope="col" aria-sort={sortBy === col.key ? sortDir === 'desc' ? 'descending' : 'ascending' : col.sortable ? 'none' : undefined} class:sortable={col.sortable && !!onsort} style={col.width ? `width:${col.width}` : ''}
            style:text-align={col.align ?? 'left'}>
            {#if col.sortable && onsort}<button type="button" class="m-table__sort" onclick={() => onsort?.(col.key)}>{col.label}{#if sortBy === col.key}<span style="opacity:.6">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>{/if}</button>{:else}{col.label}{/if}
          </th>
        {/each}
        {#if actions}<th style="width:1%"></th>{/if}
      </tr>
    </thead>
    <tbody>
      {#if loading}
        <tr><td colspan={columns.length + 1} class="m-table__empty"><span class="m-spinner"></span></td></tr>
      {:else if !rows.length}
        <tr><td colspan={columns.length + 1} class="m-table__empty">{emptyText}</td></tr>
      {:else}
        {#each rows as row, i (i)}
          <tr class:clickable={!!onrowclick} onclick={(event) => onRowClick(event, row)}>
            {#each columns as col (col.key)}
              <td style:text-align={col.align ?? 'left'}>
                {#if typeof row[col.key] === 'boolean'}
                  <span class="sr-only">{row[col.key] ? 'Yes' : 'No'}</span>
                  {#if row[col.key]}<Icon name="check" size={14} />{:else}—{/if}
                {:else if onrowclick && col.key === columns[0]?.key}
                  <button type="button" class="m-table__record-link" onclick={() => onrowclick?.(row)}>{cellValue(row, col)}</button>
                {:else}
                  {cellValue(row, col)}
                {/if}
              </td>
            {/each}
            {#if actions}<td style="white-space:nowrap">{@render actions(row)}</td>{/if}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

<style>
  .clickable { cursor: pointer; }
  .m-table__sort, .m-table__record-link { font:inherit; color:inherit; background:none; border:0; padding:0; cursor:pointer; text-align:inherit; }
  .m-table__record-link { color:var(--m-primary); text-decoration:underline; text-underline-offset:3px; }
</style>
