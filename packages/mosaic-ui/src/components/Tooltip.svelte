<script lang="ts">
  interface Props {
    text: string;
    children?: import('svelte').Snippet;
  }

  let { text, children }: Props = $props();
</script>

<span class="m-tooltip">
  {#if children}{@render children()}
  {:else}<span tabindex="0" style="cursor:help;border-bottom:1px dotted var(--m-fg-faint)">?</span>{/if}
  <span class="m-tooltip__bubble" role="tooltip">{text}</span>
</span>
