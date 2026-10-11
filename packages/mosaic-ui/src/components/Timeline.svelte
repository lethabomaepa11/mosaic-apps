<script lang="ts">
  interface Item {
    title: string;
    text?: string;
    time?: string;
  }

  interface Props {
    items: Item[];
  }

  let { items }: Props = $props();
</script>

<ul class="m-timeline">
  {#each items as item (item.title + (item.time ?? ''))}
    <li>
      <div class="m-row" style="justify-content:space-between;gap:12px">
        <strong class="m-small">{item.title}</strong>
        {#if item.time}<span class="m-small m-muted">{item.time}</span>{/if}
      </div>
      {#if item.text}<div class="m-small m-muted" style="margin-top:3px">{item.text}</div>{/if}
    </li>
  {/each}
</ul>
