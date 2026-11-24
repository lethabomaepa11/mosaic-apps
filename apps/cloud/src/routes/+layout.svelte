<script lang="ts">
  import '../app.css';
  let { children, data } = $props();
</script>

<svelte:head><meta name="theme-color" content="#ffffff" /></svelte:head>

<div class="min-h-screen bg-base-200 text-base-content">
  <header class="sticky top-0 z-20 border-b border-base-300 bg-base-100">
    <div class="app-container navbar min-h-16 px-0">
      <div class="flex-1">
        <a class="flex items-center gap-2.5 font-semibold tracking-tight" href="/" aria-label="Mosaic Cloud home">
          <span class="grid size-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-content">M</span>
          <span class="hidden min-[430px]:inline">Mosaic Cloud</span>
        </a>
      </div>
      <div class="flex items-center gap-2">
        {#if data.user}
          <span class="hidden text-sm muted md:inline">{data.user.email}</span>
          <form method="POST" action="/logout"><button class="btn btn-ghost btn-sm">Sign out</button></form>
        {/if}
      </div>
    </div>
  </header>
  <main class="app-container py-8 md:py-12">{@render children()}</main>
</div>
