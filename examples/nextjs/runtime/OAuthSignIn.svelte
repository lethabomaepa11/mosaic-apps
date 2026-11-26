<script>
  import { onMount } from 'svelte';

  let { provider = 'all', next = '/' } = $props();
  let providers = $state([]);
  onMount(async () => {
    try {
      const response = await fetch('/api/auth/oauth');
      if (response.ok) providers = (await response.json()).data?.providers ?? [];
    } catch { /* The password sign-in page remains available. */ }
  });
</script>

{#each providers.filter((item) => provider === 'all' || provider === item.id) as item (item.id)}
  <a class="m-btn m-btn--secondary" href={'/api/auth/oauth/' + encodeURIComponent(item.id) + '/start?next=' + encodeURIComponent(next)}>Continue with {item.label}</a>
{/each}
