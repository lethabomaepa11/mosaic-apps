<script module lang="ts">
  import type { Snippet } from 'svelte';

  export interface Props<T extends Record<string, unknown>> {
    title?: string;
    subtitle?: string;
    columns: { key: string; label: string; width?: string; render?: (row: T) => string; sortable?: boolean }[];
    rows: T[];
    total?: number;
    page?: number;
    pageSize?: number;
    loading?: boolean;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    onsort?: (key: string) => void;
    onpage?: (page: number) => void;
    onrowclick?: (row: T) => void;
    actions?: Snippet<[T]>;
    toolbarLeft?: Snippet;
    toolbarRight?: Snippet;
    table?: Snippet;
    emptyText?: string;
  }
</script>

<script lang="ts" generics="T extends Record<string, unknown>">

  let { title, subtitle, total, page = 1, pageSize = 20, loading, onpage, toolbarLeft, toolbarRight, table }: Props<T> = $props();
</script>

<div class="m-card m-card--flush">
  {#if title}
    <div class="m-card__header" style="padding:var(--m-space-4);margin:0;border-bottom:1px solid var(--m-border)">
      <div>
        <h3 class="m-card__title">{title}</h3>
        {#if subtitle}<div class="m-small m-muted">{subtitle}</div>{/if}
      </div>
      <div class="m-row">{@render toolbarRight?.()}</div>
    </div>
  {/if}
  <div style="padding:var(--m-space-4) var(--m-space-4) 0">
    {#if toolbarLeft}<div class="m-row" style="margin-bottom:var(--m-space-3)">{@render toolbarLeft?.()}</div>{/if}
  </div>
  <div style="padding:0 var(--m-space-4) var(--m-space-3)">
    {@render table?.()}
  </div>
</div>
