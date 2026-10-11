<script lang="ts">
  interface Item {
    label: string;
    value?: string;
  }

  interface Props {
    items: Item[];
  }

  let { items }: Props = $props();
</script>

<dl class="m-desc">
  {#each items as item (item.label)}
    <dt>{item.label}</dt>
    <dd>{item.value ?? '—'}</dd>
  {/each}
</dl>
