<script lang="ts">
  import { toast } from '../stores/toast.svelte';
</script>

<div class="m-toaster" aria-live="polite">
  {#each toast.all as t (t.id)}
    <div class="m-toast m-toast--{t.variant}">
      <span>{t.variant === 'success' ? '✓' : t.variant === 'error' ? '✕' : t.variant === 'warning' ? '⚠' : 'ℹ'}</span>
      <div>
        <strong>{t.title}</strong>
        {#if t.text}<div class="m-small m-muted">{t.text}</div>{/if}
      </div>
      <button class="m-toast__close" aria-label="Dismiss" onclick={() => toast.dismiss(t.id)}>✕</button>
    </div>
  {/each}
</div>
