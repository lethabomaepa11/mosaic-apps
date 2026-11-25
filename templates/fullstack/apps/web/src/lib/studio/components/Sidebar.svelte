<script lang="ts">
  import { page } from '$app/state';
  import { auth } from '#lib/studio/auth.svelte';
  import { Icon } from '@mosaic-apps/ui';

  const links = [
    { href: '/studio', icon: 'home', label: 'Dashboard' },
  ];
  const sections = [
    {
      name: 'Design',
      items: [
        { href: '/studio/forms', icon: 'fileText', label: 'Forms' },
        { href: '/studio/pages', icon: 'layoutGrid', label: 'Pages' },
      ],
    },
    {
      name: 'Data',
      items: [
        { href: '/studio/data/entities', icon: 'database', label: 'Entities' },
        { href: '/studio/data/migrations', icon: 'gitBranch', label: 'Migrations' },
        { href: '/studio/api', icon: 'terminal', label: 'API explorer' },
      ],
    },
    {
      name: 'Admin',
      items: [
        { href: '/studio/settings', icon: 'settings', label: 'Settings' },
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
      <a href={item.href} class:active={page.url.pathname.startsWith(item.href)}><Icon name={item.icon} /> {item.label}</a>
    {/each}
  {/each}
  <div class="studio-nav__spacer"></div>
  {#if auth.user}
    <div class="studio-nav__user" title={auth.user.email}>{auth.user.email}</div>
    <a href="/studio/login" onclick={(e) => { e.preventDefault(); auth.logout(); }}><Icon name="logOut" /> Sign out</a>
  {/if}
</nav>
