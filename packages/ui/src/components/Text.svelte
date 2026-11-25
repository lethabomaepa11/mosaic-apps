<script lang="ts">
  /** A paragraph of body copy. Plain text only (no HTML), so artifact content cannot inject markup. */
  interface Props {
    text: string;
    size?: 'sm' | 'md' | 'lg';
    muted?: boolean;
  }

  let { text, size = 'md', muted }: Props = $props();
</script>

<p class={`m-text m-text--${size}`} class:m-muted={muted}>{text}</p>

<style>
  .m-text { margin: 0 0 0.75rem; max-width: 72ch; line-height: 1.65; white-space: pre-line; color: var(--m-fg); }
  .m-text--sm { font-size: 0.875rem; }
  .m-text--md { font-size: 1rem; }
  .m-text--lg { font-size: 1.125rem; }
</style>
