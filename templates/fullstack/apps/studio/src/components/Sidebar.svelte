<script lang="ts">
  import { page } from '$app/state';
  import { auth } from '#lib/auth.svelte';
  import { Icon } from '$ui';

  const links = [
    { href: '/', icon: 'home', label: 'Dashboard' },
  ];
  const sections = [
    {
      name: 'Design',
      items: [
        { href: '/studio', icon: 'fileText', label: 'Forms' },
        { href: '/studio?kind=page', icon: 'layoutGrid', label: 'Pages' },
      ],
    },
    {
      name: 'Data',
      items: [
        { href: '/data/entities', icon: 'database', label: 'Entities' },
        { href: '/data/migrations', icon: 'gitBranch', label: 'Migrations' },
        { href: '/api', icon: 'terminal', label: 'API explorer' },
      ],
    },
    {
      name: 'Admin',
      items: [
        { href: '/settings', icon: 'settings', label: 'Settings' },
      ],
    },
  ];
</script>

<nav class="studio-nav">
  <div class="studio-nav__brand"><span class="dot"></span> Mosaic Studio</div>
  {#each links as link (link.href)}
    <a href={link.href} class:active={page.url.pathname === link.href}><Icon name={link.icon} /> {link.label}</a>
  {/each}
  {#each sections as section (section.name)}
    <div class="studio-nav__section">{section.name}</div>
    {#each section.items as item (item.href)}
      <a href={item.href} class:active={item.label === 'Pages'
        ? page.url.pathname.startsWith('/studio/pages/') || (page.url.pathname === '/studio' && page.url.searchParams.get('kind') === 'page')
        : item.label === 'Forms'
          ? page.url.pathname.startsWith('/studio/forms/') || (page.url.pathname === '/studio' && page.url.searchParams.get('kind') !== 'page')
          : page.url.pathname.startsWith(item.href)}><Icon name={item.icon} /> {item.label}</a>
    {/each}
  {/each}
  <div class="studio-nav__spacer"></div>
  {#if auth.user}
    <div style="padding:8px 10px;font-size:.72rem;color:#94a3b8">{auth.user.email}</div>
    <a href="/login" onclick={(e) => { e.preventDefault(); auth.logout(); }}><Icon name="logOut" /> Sign out</a>
  {/if}
</nav>
