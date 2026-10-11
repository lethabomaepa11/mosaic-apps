/**
 * PageRenderer - renders a published PageDef (component tree) at runtime.
 * Data-aware components (entityTable, statCard, refSelect) receive the client.
 */

<script lang="ts">
  import { ensureRoot, type PageDef } from '@mosaic/core';
  import type { MosaicClient } from '../client/api';
  import NodeRenderer from './NodeRenderer.svelte';

  interface Props {
    page: PageDef;
    client: MosaicClient;
    /** form data scope for the page (route params, query, etc.) */
    scope?: Record<string, unknown>;
  }

  let { page, client, scope }: Props = $props();

  const root = $derived(ensureRoot({ ...page.root }));
</script>

<div class="m-root m-stack">
  {#each root.children ?? [] as child (child.id)}
    <NodeRenderer node={child} {client} data={scope} />
  {/each}
</div>
