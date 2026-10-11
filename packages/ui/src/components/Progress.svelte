<script lang="ts">
  interface Props {
    value?: number; // 0..100
    variant?: 'primary' | 'success' | 'warning' | 'danger';
    showLabel?: boolean;
  }

  let { value = 0, variant = 'primary', showLabel = true }: Props = $props();
  const clamped = $derived(Math.max(0, Math.min(100, value)));
</script>

<div>
  {#if showLabel}
    <div class="m-row" style="justify-content:space-between;margin-bottom:4px">
      <span class="m-small m-muted">Progress</span>
      <span class="m-small" style="font-weight:700">{clamped}%</span>
    </div>
  {/if}
  <div class="m-progress" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
    <div class="m-progress__bar" class:m-progress__bar--success={variant === 'success'}
      class:m-progress__bar--warning={variant === 'warning'} class:m-progress__bar--danger={variant === 'danger'}
      style="width:{clamped}%"></div>
  </div>
</div>
