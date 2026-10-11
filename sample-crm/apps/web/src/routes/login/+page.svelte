<script lang="ts">
  import { goto } from '$app/navigation';
  import { client } from '#lib/client';
  import { toast } from '@mosaic/ui';

  let email = $state('admin@mosaic.local');
  let password = $state('admin1234');
  let error = $state('');
  let busy = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      const res = await client.login(email, password);
      client.setToken(res.token);
      toast.success(`Signed in as ${res.user.name}`);
      await goto('/');
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Sign in · Sample Crm</title></svelte:head>

<div style="max-width:380px;margin:6vh auto">
  <form class="m-card m-stack" onsubmit={submit}>
    <h1 class="m-h3" style="margin:0">Sign in</h1>
    <label class="m-field">
      <span class="m-field__label">Email</span>
      <input class="m-input" type="email" bind:value={email} autocomplete="username" required />
    </label>
    <label class="m-field">
      <span class="m-field__label">Password</span>
      <input class="m-input" type="password" bind:value={password} autocomplete="current-password" required />
    </label>
    {#if error}<span class="m-field__error">{error}</span>{/if}
    <button class="m-btn m-btn--primary m-btn--block" disabled={busy} type="submit">
      {busy ? 'Signing in…' : 'Sign in'}
    </button>
  </form>
</div>
