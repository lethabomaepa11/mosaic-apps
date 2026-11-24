<script lang="ts">let { form } = $props();</script>
<svelte:head><title>Sign in · Mosaic Cloud</title><meta name="description" content="Sign in to Mosaic Cloud." /></svelte:head>

<section class="mx-auto grid max-w-md gap-6 py-8 md:py-16">
  <header><p class="section-label">Mosaic Studio</p><h1 class="page-title mb-3">Sign in to your workspace</h1><p class="muted leading-6">Create projects, manage source delivery, and deploy applications.</p></header>
  <form method="POST" class="surface space-y-4 p-6">
    <fieldset class="fieldset"><legend class="fieldset-legend">Email</legend><input class="input input-bordered w-full" id="email" name="email" type="email" value={form?.email ?? ''} autocomplete="email" required /></fieldset>
    <fieldset class="fieldset"><legend class="fieldset-legend">Password</legend><input class="input input-bordered w-full" id="password" name="password" type="password" autocomplete="current-password" required /></fieldset>
    {#if form?.message}<div class="alert alert-error text-sm" role="alert">{form.message}</div>{/if}
    <button class="btn btn-primary w-full" type="submit">Sign in</button>
  </form>
</section>
