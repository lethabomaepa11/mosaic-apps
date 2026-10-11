<script lang="ts">
  import Icon from './Icon.svelte';
  import ShadcnButton from '../shadcn/button/Button.svelte';

  interface Props {
    value: unknown;
    collapsed?: boolean;
  }

  let { value, collapsed = false }: Props = $props();

  const text = $derived(JSON.stringify(value, null, 2) ?? 'null');
  // svelte-ignore state_referenced_locally -- intentional: initial expanded from prop
  let expanded = $state(!collapsed);
</script>

<div>
  <ShadcnButton variant="ghost" size="sm" class="m-btn m-btn--ghost m-btn--sm" style="margin-bottom:6px" onclick={() => (expanded = !expanded)}>
    <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={12} /> {expanded ? 'Collapse' : 'Expand'} JSON
  </ShadcnButton>
  {#if expanded}<pre class="m-jsonview">{text}</pre>{/if}
</div>
