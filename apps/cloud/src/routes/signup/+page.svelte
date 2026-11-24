<script lang="ts">let { form } = $props();</script>
<svelte:head><title>Create account · Mosaic Cloud</title><meta name="description" content="Create your Mosaic Cloud workspace." /></svelte:head>

<section class="mx-auto grid max-w-md gap-6 py-8 md:py-16">
  <header><p class="section-label">Mosaic Studio</p><h1 class="page-title mb-3">Create your workspace</h1><p class="muted leading-6">Describe, build, and deploy business or passion apps from one place.</p></header>
  <form method="POST" class="surface space-y-4 p-6">
    <fieldset class="fieldset"><legend class="fieldset-legend">Full name</legend><input class="input input-bordered w-full" name="name" value={form?.name ?? ''} autocomplete="name" required /></fieldset>
    <fieldset class="fieldset"><legend class="fieldset-legend">Email</legend><input class="input input-bordered w-full" name="email" type="email" value={form?.email ?? ''} autocomplete="email" required /></fieldset>
    <fieldset class="fieldset"><legend class="fieldset-legend">Password</legend><input class="input input-bordered w-full" name="password" type="password" minlength="8" autocomplete="new-password" required /><p class="label text-xs muted">At least 8 characters.</p></fieldset>
    {#if form?.message}<div class="alert alert-error text-sm" role="alert">{form.message}</div>{/if}
    <button class="btn btn-primary w-full" type="submit">Create account</button>
    <p class="mb-0 text-center text-sm muted">Already have an account? <a class="link link-primary font-medium" href="/login">Sign in</a></p>
  </form>
</section>
