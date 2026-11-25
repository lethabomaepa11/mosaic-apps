<script lang="ts">
  import { onMount } from 'svelte';
  import type { MosaicClient } from '../client/api';
  let { client, provider = 'all', next = '/', linkAccounts = false }: {
    client?: MosaicClient; provider?: string; next?: string; linkAccounts?: boolean;
  } = $props();
  let choices = $state<{ id: 'google' | 'github'; label: string }[]>([]);
  let signedIn = $state(false);
  const base = $derived(client?.apiBase ?? '/api');

  onMount(async () => {
    if (!client) return;
    try {
      const response = await fetch(`${base}/auth/oauth`);
      if (!response.ok) return;
      const { data } = await response.json();
      signedIn = data?.signedIn === true;
      choices = (data?.providers ?? []).filter((item: { id: string }) => item.id === 'google' || item.id === 'github');
    } catch { /* Password sign-in remains available. */ }
  });

  const selected = $derived(choices.filter(({ id }) => provider === 'all' || id === provider));
  const url = (id: string) => `${base}/auth/oauth/${id}/start?next=${encodeURIComponent(next)}`;
</script>

{#if selected.length}
  <div class="m-stack" aria-label="Sign-in providers">
    {#each selected as item (item.id)}
      {#if signedIn && linkAccounts}
        <form action={url(item.id)} method="POST">
          <button type="submit" class="m-btn m-btn--secondary m-btn--block">Link {item.label} account</button>
        </form>
      {:else}
        <a class="m-btn m-btn--secondary m-btn--block" href={url(item.id)} data-sveltekit-reload onclick={() => client?.setToken(null)}>Continue with {item.label}</a>
      {/if}
    {/each}
  </div>
{:else if !client}
  <p class="m-muted">OAuth sign-in buttons</p>
{/if}
