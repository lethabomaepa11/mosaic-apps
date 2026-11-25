<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { client } from '#lib/client';
  import { toast } from '@mosaic-apps/ui';

  let { data } = $props();
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);
  const title = $derived(data.registering ? 'Create an account' : 'Sign in');

  async function submit(e: Event) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      const res = data.registering ? await register() : await client.login(email, password);
      client.setToken(res.token);
      toast.success(`Signed in as ${res.user.name}`);
      const next = page.url.searchParams.get('next');
      await goto(next && /^\/(?![/\\])/.test(next) && !/[\\\u0000-\u001f]/.test(next) ? next : '/');
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  async function register() {
    const response = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, password }),
    });
    if (!response.ok) throw new Error(response.status === 409 ? 'This email already has an account.' : 'Account creation failed. Check your details and try again.');
    return (await response.json()).data;
  }
</script>

<svelte:head><title>{title} · __PROJECT_NAME__</title></svelte:head>

<div style="max-width:380px;margin:6vh auto">
  <form class="m-card m-stack" onsubmit={submit}>
    <h1 class="m-h3" style="margin:0">{title}</h1>
    {#if data.registering}<label class="m-field"><span class="m-field__label">Name</span><input class="m-input" bind:value={name} autocomplete="name" required /></label>{/if}
    <label class="m-field">
      <span class="m-field__label">Email</span>
      <input class="m-input" type="email" bind:value={email} autocomplete="username" required />
    </label>
    <label class="m-field">
      <span class="m-field__label">Password</span>
      <input class="m-input" type="password" bind:value={password} autocomplete={data.registering ? 'new-password' : 'current-password'} minlength={data.registering ? 8 : undefined} required />
    </label>
    {#if error}<span class="m-field__error" role="alert">{error}</span>{/if}
    <button class="m-btn m-btn--primary m-btn--block" disabled={busy} type="submit">
      {busy ? 'Please wait…' : title}
    </button>
    {#if data.allowRegistration}<a href={data.registering ? '/login' : '/login?mode=signup'}>{data.registering ? 'Already have an account? Sign in' : 'Create an account'}</a>{/if}
  </form>
</div>
