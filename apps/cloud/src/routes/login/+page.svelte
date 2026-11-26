<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { GitBranch } from '@lucide/svelte';
  let { data, form } = $props();
  const githubError = $derived(page.url.searchParams.get('error'));
</script>
<svelte:head><title>Sign in · Mosaic Cloud</title><meta name="description" content="Sign in to Mosaic Cloud." /></svelte:head>

<section class="hero-glow -mx-4 -mt-8 grid min-h-[75vh] place-items-center px-4 md:-mt-12">
<div class="grid w-full max-w-sm gap-6">
  <header class="text-center"><span class="mx-auto mb-5 grid size-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet-500 text-lg font-bold text-primary-content shadow-md">M</span><h1 class="mb-2 text-2xl font-semibold tracking-tight">Welcome back</h1><p class="mb-0 text-sm muted">Sign in to build and deploy your apps.</p></header>
  <div class="surface-raised space-y-4 p-6">
    {#if data.githubLogin}
      <!-- GitHub's consent screen is on github.com, so this is a real navigation by design. -->
      <a class="btn btn-neutral w-full gap-2" href={`/auth/github?${new URLSearchParams({ next: data.next })}`} data-sveltekit-reload><GitBranch size={16} /> Continue with GitHub</a>
      <div class="divider my-1 text-xs muted">or</div>
    {/if}
    {#if githubError}<div class="alert alert-error text-sm" role="alert">{githubError}</div>{/if}
    <form method="POST" use:enhance class="space-y-4">
      <fieldset class="fieldset"><legend class="fieldset-legend">Email</legend><input class="input input-bordered w-full" id="email" name="email" type="email" value={form?.email ?? ''} autocomplete="email" required /></fieldset>
      <fieldset class="fieldset"><legend class="fieldset-legend">Password</legend><input class="input input-bordered w-full" id="password" name="password" type="password" autocomplete="current-password" required /></fieldset>
      {#if form?.message}<div class="alert alert-error text-sm" role="alert">{form.message}</div>{/if}
      <button class="btn btn-primary w-full" type="submit">Sign in</button>
    </form>
    <p class="mb-0 text-center text-sm muted">New to Mosaic? <a class="link link-primary font-medium" href="/signup">Create an account</a></p>
  </div>
</div>
</section>
