<script lang="ts" generics="T extends Record<string, unknown>">
  import type { Snippet } from 'svelte';

  interface Column {
    key: string;
    label: string;
    width?: string;
    align?: 'left' | 'right' | 'center';
    render?: (row: T) => string;
    sortable?: boolean;
  }

  interface Props {
    columns: Column[];
    rows: T[];
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    onsort?: (key: string) => void;
    onrowclick?: (row: T) => void;
    emptyText?: string;
    actions?: Snippet<[T]>;
    loading?: boolean;
  }

  let { columns, rows, sortBy, sortDir, onsort, onrowclick, emptyText = 'No records', actions, loading }: Props = $props();

  function cell(row: T, col: Column): string {
    const v = row[col.key];
    if (col.render) return col.render(row);
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? '✓' : '—';
    if (typeof v === 'object') return JSON.stringify(v);
    if (col.key === 'createdAt' || col.key === 'updatedAt') {
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
    }
    return String(v);
  }
</script>

<div class="m-table-wrap">
  <table class="m-table">
    <thead>
      <tr>
        {#each columns as col (col.key)}
          <th class:sortable={col.sortable && !!onsort} style={col.width ? `width:${col.width}` : ''}
            style:text-align={col.align ?? 'left'}
            onclick={() => col.sortable && onsort?.(col.key)}>
            {col.label}{#if sortBy === col.key}<span style="opacity:.6">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>{/if}
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
          <tr class:clickable={!!onrowclick} onclick={() => onrowclick?.(row)}>
            {#each columns as col (col.key)}
              <td style:text-align={col.align ?? 'left'}>{cell(row, col)}</td>
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
</style>
