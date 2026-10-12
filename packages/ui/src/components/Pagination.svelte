<script lang="ts">
  import ShadcnButton from '../shadcn/button/Button.svelte';
  import SelectField from './SelectField.svelte';
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
    <ShadcnButton variant="ghost" size="sm" class="m-btn m-btn--ghost m-btn--sm" disabled={page <= 1} onclick={() => onpage?.(page - 1)}>‹ Prev</ShadcnButton>
    {#each pages() as p (p)}
      <ShadcnButton variant={p === page ? 'default' : 'ghost'} size="sm" class={p === page ? 'm-btn m-btn--sm m-btn--primary' : 'm-btn m-btn--sm m-btn--ghost'}
        style="min-width:32px" onclick={() => onpage?.(p)}>{p}</ShadcnButton>
    {/each}
    <ShadcnButton variant="ghost" size="sm" class="m-btn m-btn--ghost m-btn--sm" disabled={page >= pageCount} onclick={() => onpage?.(page + 1)}>Next ›</ShadcnButton>
  </div>
  <div style="min-width:100px"><SelectField label="Rows" value={String(pageSize)} clearable={false} disabled={!onpagesize} options={[...new Set([...pageSizes, pageSize])].sort((a,b) => a-b).map(size => ({ value:String(size), label:String(size) }))} oninput={value => onpagesize?.(Number(value))} /></div>
</div>
