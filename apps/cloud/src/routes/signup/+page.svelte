<script lang="ts">import { enhance } from '$app/forms'; let { form } = $props();</script>
<svelte:head><title>Create account · Mosaic Cloud</title><meta name="description" content="Create your Mosaic Cloud workspace." /></svelte:head>

<section class="hero-glow -mx-4 -mt-8 grid min-h-[75vh] place-items-center px-4 md:-mt-12">
<div class="grid w-full max-w-sm gap-6">
  <header class="text-center"><span class="mx-auto mb-5 grid size-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet-500 text-lg font-bold text-primary-content shadow-md">M</span><h1 class="mb-2 text-2xl font-semibold tracking-tight">Create your workspace</h1><p class="mb-0 text-sm muted">Describe an app, watch it build, and own the code.</p></header>
  <form method="POST" use:enhance class="surface-raised space-y-4 p-6">
    <fieldset class="fieldset"><legend class="fieldset-legend">Full name</legend><input class="input input-bordered w-full" name="name" value={form?.name ?? ''} autocomplete="name" required /></fieldset>
    <fieldset class="fieldset"><legend class="fieldset-legend">Email</legend><input class="input input-bordered w-full" name="email" type="email" value={form?.email ?? ''} autocomplete="email" required /></fieldset>
    <fieldset class="fieldset"><legend class="fieldset-legend">Password</legend><input class="input input-bordered w-full" name="password" type="password" minlength="8" autocomplete="new-password" required /><p class="label text-xs muted">At least 8 characters.</p></fieldset>
    {#if form?.message}<div class="alert alert-error text-sm" role="alert">{form.message}</div>{/if}
    <button class="btn btn-primary w-full" type="submit">Create account</button>
    <p class="mb-0 text-center text-sm muted">Already have an account? <a class="link link-primary font-medium" href="/login">Sign in</a></p>
  </form>
</div>
</section>
