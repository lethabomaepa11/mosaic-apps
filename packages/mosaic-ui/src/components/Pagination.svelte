<script lang="ts">
  interface Props {
    page: number;
    pageSize: number;
    total: number;
    onpage?: (page: number) => void;
    onpagesize?: (size: number) => void;
    pageSizes?: number[];
  }

  let { page, pageSize, total, onpage, onpagesize, pageSizes = [10, 20, 50, 100] }: Props = $props();

  const pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)));
  const from = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
  const to = $derived(Math.min(total, page * pageSize));

  function pages(): number[] {
    const out: number[] = [];
    const start = Math.max(1, Math.min(page - 2, pageCount - 4));
    const end = Math.min(pageCount, start + 4);
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }
</script>

<div class="m-pagination">
  <span>{from}–{to} of {total}</span>
  <div class="m-pagination__pages">
    <button class="m-btn m-btn--ghost m-btn--sm" disabled={page <= 1} onclick={() => onpage?.(page - 1)}>‹ Prev</button>
    {#each pages() as p (p)}
      <button class="m-btn m-btn--sm" class:m-btn--primary={p === page} class:m-btn--ghost={p !== page}
        style="min-width:32px" onclick={() => onpage?.(p)}>{p}</button>
    {/each}
    <button class="m-btn m-btn--ghost m-btn--sm" disabled={page >= pageCount} onclick={() => onpage?.(page + 1)}>Next ›</button>
  </div>
  <label class="m-row" style="gap:6px">
    <span class="m-small m-muted">Rows</span>
    <select class="m-select" style="width:auto" value={String(pageSize)} onchange={(e) => onpagesize?.(Number((e.currentTarget as HTMLSelectElement).value))}>
      {#each pageSizes as s (s)}<option value={s}>{s}</option>{/each}
    </select>
  </label>
</div>
