<script lang="ts">
  import { getComponent, isContainerType } from '../registry/index';
  import type { FormNode } from '@mosaic/core';
  import NodeChildren from './NodeChildren.svelte';

  const input: {
    node: FormNode;
    visible?: (node: FormNode) => boolean;
    disabled?: (node: FormNode) => boolean;
    client?: unknown;
    data?: Record<string, unknown>;
    errors?: Record<string, string>;
    onField?: (binding: string, value: unknown) => void;
  } = $props();

  const node = $derived(input.node);
  const visible = $derived(input.visible);
  const disabled = $derived(input.disabled);
  const client = $derived(input.client as import('../client/api').MosaicClient | undefined);
  const data = $derived(input.data);
  const errors = $derived(input.errors);
  const onField = $derived(input.onField);

  const def = $derived(getComponent(node.type));
  const nodeProps = $derived(node.props ?? {});
  const binding = $derived(typeof nodeProps.binding === 'string' ? nodeProps.binding : undefined);
  const value = $derived(binding && data ? data[binding] : nodeProps.value);
  const error = $derived(binding && errors ? errors[binding] : undefined);

  // strip framework-level props before spreading into the component
  const rest = $derived(
    Object.fromEntries(
      Object.entries(nodeProps).filter(([k]) => k !== 'binding' && k !== 'visibleIf' && k !== 'disabledIf' && k !== 'colSpan'),
    ),
  );

  function oninput(v: unknown) {
    if (binding) onField?.(binding, v);
    else if (typeof nodeProps.oninput === 'function') (nodeProps.oninput as (v: unknown) => void)(v);
  }
</script>

{#if (!visible || visible(node))}
  {#if def}
    {@const Comp = def.component}
    <Comp
      {...rest}
      {client}
      {value}
      {error}
      disabled={nodeProps.disabled === true || disabled?.(node) === true}
      oninput={oninput}
    >
      {#if isContainerType(node.type)}
        <NodeChildren nodes={node.children ?? []} {visible} {disabled} {client} {data} {errors} {onField}></NodeChildren>
      {/if}
    </Comp>
  {:else}
    <div class="m-alert m-alert--warning">Unknown component <code>{node.type}</code></div>
  {/if}
{/if}
