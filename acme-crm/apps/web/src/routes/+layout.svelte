<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '\$app/state';
  import '../app.css';
  import { Toaster } from '@mosaic/ui';
  import { client } from '#lib/client';

  let { children } = $props();

  let user = $state<{ email: string; name: string; roles: string[] } | null>(null);

  $effect(() => {
    if (browser) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          /* offline support unavailable */
        });
      }
      client
        .me()
        .then((me) => { user = me; })
        .catch(() => { user = null; });
    }
  });

  function logout() {
    client.logout().finally(() => {
      client.setToken(null);
      user = null;
      window.location.href = '/login';
    });
  }
</script>

<div class="app-shell">
  <nav class="app-nav">
    <div class="app-nav__brand"><span class="dot"></span> Acme CRM</div>
    <a href="/" class:active={page.url.pathname === '/'}>🏠 Home</a>
    <div class="app-nav__spacer"></div>
    {#if user}
      <div style="padding:8px 10px;font-size:.75rem;color:#94a3b8">{user.email}</div>
      <a href="/login" onclick={(e) => { e.preventDefault(); logout(); }}>↩ Sign out</a>
    {:else}
      <a href="/login" class:active={page.url.pathname === '/login'}>🔐 Sign in</a>
    {/if}
  </nav>
  <main class="app-main">
    {@render children()}
  </main>
</div>
<Toaster />
