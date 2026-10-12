<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '#lib/auth.svelte';
  import { TextField, toast } from '@mosaic-apps/ui';

  let email = $state(import.meta.env.DEV ? 'admin@mosaic.local' : '');
  let password = $state(import.meta.env.DEV ? 'admin1234' : '');
  let error = $state('');
  let busy = $state(false);

  $effect(() => {
    if (auth.ready && auth.user) goto('/');
  });

  async function submit(e: Event) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      await auth.login(email, password);
      toast.success('Signed in');
      await goto('/');
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Sign in · Mosaic Studio</title></svelte:head>

<div style="width:min(380px,92vw)">
  <form class="m-card m-stack" onsubmit={submit}>
    <div class="m-row" style="gap:10px">
      <span style="width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#6366f1,#8b5cf6)"></span>
      <strong>Mosaic Studio</strong>
    </div>
    <TextField label="Email" format="email" bind:value={email} autocomplete="username" required />
    <TextField label="Password" format="password" bind:value={password} autocomplete="current-password" required />
    {#if error}<span class="m-field__error">{error}</span>{/if}
    <button class="m-btn m-btn--primary m-btn--block" type="submit" disabled={busy}>
      {busy ? 'Signing in…' : 'Sign in'}
    </button>
    {#if import.meta.env.DEV}<p class="m-small m-muted" style="margin:0">Default seeded admin: admin@mosaic.local / admin1234</p>{/if}
  </form>
</div>

