<script lang="ts">
  import { onMount } from 'svelte';
  import { Tabs, toast } from '@mosaic-apps/mosaic-ui';
  import type { AuditEntry, RefList, SettingRecord, UserRecord } from '@mosaic-apps/mosaic-core';
  import { client } from '#lib/client';
  import SettingsUsers from '../../components/SettingsUsers.svelte';
  import SettingsRoles from '../../components/SettingsRoles.svelte';
  import SettingsAdmin from '../../components/SettingsAdmin.svelte';
  import ThemeEditor from '../../components/ThemeEditor.svelte';
  import NavigationEditor from '../../components/NavigationEditor.svelte';

  interface Role {
    name: string;
    displayName: string;
    description: string;
    permissions: string[];
  }

  let tab = $state('users');
  let users = $state<UserRecord[]>([]);
  let roles = $state<Role[]>([]);
  let refLists = $state<RefList[]>([]);
  let settings = $state<(SettingRecord & { updatedAt: string })[]>([]);
  let audit = $state<AuditEntry[]>([]);

  onMount(async () => {
    try {
      const [u, r, rl, s] = await Promise.all([
        client.listUsers(),
        client.listRoles(),
        client.listRefLists(),
        client.listSettings(),
      ]);
      users = u;
      roles = r;
      refLists = rl;
      settings = s;
      const a = await client.listAudit({ pageSize: 30 });
      audit = a.data;
    } catch (err) {
      toast.error('Could not load admin data', err instanceof Error ? err.message : String(err));
    }
  });
</script>

<svelte:head><title>Settings · Mosaic Studio</title></svelte:head>

<header class="app-header">
  <h1 class="m-h2" style="margin:0">Settings & administration</h1>
</header>

<Tabs
  tabs={[
    { id: 'users', label: 'Users' },
    { id: 'roles', label: 'Roles' },
    { id: 'admin', label: 'Reference lists · Settings · Audit' },
    { id: 'theme', label: 'Theme' },
    { id: 'navigation', label: 'Navigation' },
  ]}
  bind:active={tab}
/>

<div style="margin-top:16px">
  {#if tab === 'theme'}
    <ThemeEditor />
  {:else if tab === 'navigation'}
    <NavigationEditor />
  {:else if tab === 'users'}
    <SettingsUsers {users} {roles} onchange={(next) => (users = next)} />
  {:else if tab === 'roles'}
    <SettingsRoles {roles} onchange={(next) => (roles = next)} />
  {:else}
    <SettingsAdmin
      {refLists}
      {settings}
      {audit}
      onsettings={(next) => (settings = next)}
      onrefreshreflists={async () => (refLists = await client.listRefLists())}
    />
  {/if}
</div>

