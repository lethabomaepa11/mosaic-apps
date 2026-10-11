<script lang="ts">
  import { page } from '$app/state';
  import { auth } from '#lib/auth.svelte';

  const links = [
    { href: '/', icon: 'đźŹ ', label: 'Dashboard' },
  ];
  const sections = [
    {
      name: 'Design',
      items: [
        { href: '/design/forms', icon: 'đź“ť', label: 'Forms' },
        { href: '/design/pages', icon: 'đź“„', label: 'Pages' },
      ],
    },
    {
      name: 'Data',
      items: [
        { href: '/data/entities', icon: 'đź—ď¸Ź', label: 'Entities' },
        { href: '/data/migrations', icon: 'đź§¬', label: 'Migrations' },
        { href: '/api', icon: 'đź”Ś', label: 'API explorer' },
      ],
    },
    {
      name: 'Admin',
      items: [
        { href: '/settings', icon: 'âš™ď¸Ź', label: 'Settings' },
      ],
    },
  ];
</script>

<nav class="studio-nav">
  <div class="studio-nav__brand"><span class="dot"></span> Mosaic Studio</div>
  {#each links as link (link.href)}
    <a href={link.href} class:active={page.url.pathname === link.href}>{link.icon} {link.label}</a>
  {/each}
  {#each sections as section (section.name)}
    <div class="studio-nav__section">{section.name}</div>
    {#each section.items as item (item.href)}
      <a href={item.href} class:active={page.url.pathname.startsWith(item.href)}>{item.icon} {item.label}</a>
    {/each}
  {/each}
  <div class="studio-nav__spacer"></div>
  {#if auth.user}
    <div style="padding:8px 10px;font-size:.72rem;color:#94a3b8">{auth.user.email}</div>
    <a href="/login" onclick={(e) => { e.preventDefault(); auth.logout(); }}>â†© Sign out</a>
  {/if}
</nav>
