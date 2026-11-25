<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { client } from '#lib/client';
  import { toast } from '@mosaic-apps/ui';

  import type { authPageLayout } from '#lib/server/auth-page';
  let { data }: { data: { registering: boolean; allowRegistration: boolean; layout: Awaited<ReturnType<typeof authPageLayout>> } } = $props();
  let fields = $state({ name: '', email: '', password: '' });
  let error = $state('');
  let busy = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      const res = data.registering ? await register() : await client.login(fields.email, fields.password);
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
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fields),
    });
    if (!response.ok) throw new Error(response.status === 409 ? 'This email already has an account.' : 'Account creation failed. Check your details and try again.');
    return (await response.json()).data;
  }
</script>

<svelte:head><title>{data.layout.title} · __PROJECT_NAME__</title></svelte:head>

<div style="max-width:380px;margin:6vh auto">
  <form class="m-card m-stack" onsubmit={submit}>
    <h1 class="m-h3" style="margin:0">{data.layout.title}</h1>
    {#each data.layout.copy as paragraph}<p>{paragraph}</p>{/each}
    {#each data.layout.fields as field (field.name)}
      <label class="m-field"><span class="m-field__label">{field.label}</span>
        <input class="m-input" name={field.name} type={field.name === 'name' ? 'text' : field.name} value={fields[field.name]} oninput={(event) => (fields[field.name] = event.currentTarget.value)}
          autocomplete={field.name === 'password' ? (data.registering ? 'new-password' : 'current-password') : field.name === 'email' ? 'username' : 'name'}
          minlength={data.registering && field.name === 'password' ? 8 : undefined} required />
      </label>
    {/each}
    {#if error}<span class="m-field__error" role="alert">{error}</span>{/if}
    <button class="m-btn m-btn--primary m-btn--block" disabled={busy} type="submit">
      {busy ? 'Please wait…' : data.layout.submitLabel}
    </button>
    {#if data.allowRegistration}<a href={data.registering ? '/login' : '/signup'}>{data.layout.alternateLabel}</a>{/if}
  </form>
</div>
