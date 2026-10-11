<script lang="ts">
  import NodeRenderer from './NodeRenderer.svelte';
  import type { NodeChildrenProps } from './node-props';

  let { nodes, visible, disabled, client, data, errors, onField }: NodeChildrenProps = $props();
</script>

{#each nodes as child (child.id)}
  <NodeRenderer node={child} {visible} {disabled} {client} {data} {errors} {onField} />
{/each}
