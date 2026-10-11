<script lang="ts">
  import NodeRenderer from './NodeRenderer.svelte';
  import type { NodeChildrenProps } from './node-props';

  let { nodes, visible, disabled, client, data, errors, mode, onField, transition }: NodeChildrenProps = $props();
</script>

{#each nodes as child, index (child.id)}
  {@const childTransition = transition ? { ...transition, delay: (transition.delay ?? 0) + index * 18 } : undefined}
  <NodeRenderer node={child} {visible} {disabled} {client} {data} {errors} {mode} {onField} transition={childTransition} />
{/each}
