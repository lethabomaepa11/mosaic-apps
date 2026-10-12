<script lang="ts">
  import { onDestroy } from 'svelte';
  import Modal from './Modal.svelte';
  import type { MosaicConfirm } from '../actions/confirmation';
  let open = $state(false);
  let title = $state(''); let description = $state(''); let confirmLabel = $state('Continue'); let cancelLabel = $state('Cancel');
  let finish: ((confirmed: boolean) => void) | undefined;
  export const confirm: MosaicConfirm = options => new Promise<boolean>(resolve => {
    finish?.(false);
    if (options.signal.aborted) { resolve(false); return; }
    const abort = () => finish?.(false);
    finish = value => { options.signal.removeEventListener('abort', abort); finish = undefined; open = false; resolve(value); };
    title = options.title; description = options.description ?? ''; confirmLabel = options.confirmLabel ?? 'Continue'; cancelLabel = options.cancelLabel ?? 'Cancel';
    options.signal.addEventListener('abort', abort, { once: true }); open = true;
  });
  onDestroy(() => finish?.(false));
</script>
<Modal bind:open {title} onclose={() => finish?.(false)}>
  {#if description}<p>{description}</p>{/if}
  {#snippet footer()}<button type="button" class="m-btn m-btn--secondary" onclick={() => finish?.(false)}>{cancelLabel}</button><button type="button" class="m-btn m-btn--primary" onclick={() => finish?.(true)}>{confirmLabel}</button>{/snippet}
</Modal>
