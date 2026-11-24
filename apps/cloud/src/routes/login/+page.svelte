<script lang="ts">import { enhance } from '$app/forms'; let { form } = $props();</script>
<svelte:head><title>Sign in · Mosaic Cloud</title><meta name="description" content="Sign in to Mosaic Cloud." /></svelte:head>

<section class="hero-glow -mx-4 -mt-8 grid min-h-[75vh] place-items-center px-4 md:-mt-12">
<div class="grid w-full max-w-sm gap-6">
  <header class="text-center"><span class="mx-auto mb-5 grid size-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet-500 text-lg font-bold text-primary-content shadow-md">M</span><h1 class="mb-2 text-2xl font-semibold tracking-tight">Welcome back</h1><p class="mb-0 text-sm muted">Sign in to build and deploy your apps.</p></header>
  <form method="POST" use:enhance class="surface-raised space-y-4 p-6">
    <fieldset class="fieldset"><legend class="fieldset-legend">Email</legend><input class="input input-bordered w-full" id="email" name="email" type="email" value={form?.email ?? ''} autocomplete="email" required /></fieldset>
    <fieldset class="fieldset"><legend class="fieldset-legend">Password</legend><input class="input input-bordered w-full" id="password" name="password" type="password" autocomplete="current-password" required /></fieldset>
    {#if form?.message}<div class="alert alert-error text-sm" role="alert">{form.message}</div>{/if}
    <button class="btn btn-primary w-full" type="submit">Sign in</button>
    <p class="mb-0 text-center text-sm muted">New to Mosaic? <a class="link link-primary font-medium" href="/signup">Create an account</a></p>
  </form>
</div>
</section>
