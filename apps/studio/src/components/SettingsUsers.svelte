<script lang="ts">
  import { Icon, SelectField, TextField, toast } from '@mosaic-apps/mosaic-ui';
  import type { UserRecord } from '@mosaic-apps/mosaic-core';
  import { client } from '#lib/client';

  interface Props {
    users: UserRecord[];
    roles: { name: string; displayName: string; description: string; permissions: string[] }[];
    onchange: (users: UserRecord[]) => void;
  }

  let { users, roles, onchange }: Props = $props();
  let newUser = $state({ email: '', password: '', name: '', role: 'viewer' });

  async function createUser() {
    try {
      await client.createUser({
        email: newUser.email,
        password: newUser.password,
        name: newUser.name || newUser.email,
        roles: [newUser.role],
      });
      onchange(await client.listUsers());
      newUser = { email: '', password: '', name: '', role: 'viewer' };
      toast.success('User created');
    } catch (err) {
      toast.error('Create failed', err instanceof Error ? err.message : String(err));
    }
  }

  async function toggleUser(user: UserRecord) {
    try {
      await client.updateUser(user.id, { disabled: !user.disabled });
      onchange(await client.listUsers());
    } catch (err) {
      toast.error('Update failed', err instanceof Error ? err.message : String(err));
    }
  }

  async function removeUser(id: string) {
    if (!confirm('Delete this user?')) return;
    try {
      await client.deleteUser(id);
      onchange(await client.listUsers());
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : String(err));
    }
  }
</script>

<section class="m-card" style="margin-bottom:16px">
  <header class="m-card__header"><strong>Invite user</strong></header>
  <div class="m-row">
    <div style="width:200px"><TextField label="Email" bind:value={newUser.email} /></div>
    <div style="width:160px"><TextField label="Name" bind:value={newUser.name} /></div>
    <div style="width:160px"><TextField label="Password" bind:value={newUser.password} format="password" /></div>
    <div style="width:140px">
      <SelectField
        label="Role"
        value={newUser.role}
        options={roles.map((r) => ({ value: r.name, label: r.name }))}
        oninput={(v) => (newUser.role = String(v ?? 'viewer'))}
      />
    </div>
    <button class="m-btn m-btn--primary" style="align-self:flex-end" onclick={createUser}>Create</button>
  </div>
</section>

<section class="m-card">
  <table class="kv">
    <thead><tr><th>User</th><th>Roles</th><th>Status</th><th>Last login</th><th></th></tr></thead>
    <tbody>
      {#each users as user (user.id)}
        <tr>
          <td><strong>{user.name}</strong><div class="m-small m-muted">{user.email}</div></td>
          <td>{#each user.roles as r (r)}<span class="m-badge" style="margin-right:4px">{r}</span>{/each}</td>
          <td>{#if user.disabled}<span class="m-badge m-badge--danger">disabled</span>{:else}<span class="m-badge m-badge--success">active</span>{/if}</td>
          <td class="m-small m-muted">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}</td>
          <td>
            <button class="m-btn m-btn--ghost m-btn--sm" onclick={() => toggleUser(user)}>{user.disabled ? 'Enable' : 'Disable'}</button>
            <button class="m-btn m-btn--ghost m-btn--icon" aria-label="Remove user" onclick={() => removeUser(user.id)}><Icon name="x" size={14} /></button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

