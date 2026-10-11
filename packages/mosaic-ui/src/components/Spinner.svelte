<script lang="ts">
  interface Props {
    size?: 'sm' | 'lg';
  }

  let { size }: Props = $props();
</script>

<span class="m-spinner" class:m-spinner--lg={size === 'lg'} role="status" aria-label="Loading"></span>
