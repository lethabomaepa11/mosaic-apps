<script lang="ts">
  import { TextArea, toast } from '@mosaic-apps/mosaic-ui';
  import { client } from '#lib/client';

  interface Role {
    name: string;
    displayName: string;
    description: string;
    permissions: string[];
  }

  interface Props {
    roles: Role[];
    onchange: (roles: Role[]) => void;
  }

  let { roles, onchange }: Props = $props();

  async function saveRole(role: Role) {
    try {
      await client.saveRole(role.name, {
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
      });
      toast.success(`Role ${role.name} saved`);
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : String(err));
    }
  }

  function setPermissions(i: number, permissions: string[]) {
    const next = [...roles];
    next[i] = { ...next[i]!, permissions };
    onchange(next);
  }
</script>

<div class="cards">
  {#each roles as role, i (role.name)}
    <section class="m-card">
      <div class="m-row" style="justify-content:space-between;margin-bottom:10px">
        <strong>{role.displayName || role.name}</strong>
        <code class="m-badge">{role.name}</code>
      </div>
      <TextArea
        label="Permissions (one per line; `*` = admin, `entity:*:read`, `forms:manage`…)"
        rows={6}
        value={role.permissions.join('\n')}
        oninput={(v) =>
          setPermissions(
            i,
            String(v ?? '')
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
          )}
      />
      <button class="m-btn m-btn--primary m-btn--sm" style="margin-top:10px" onclick={() => saveRole(roles[i]!)}>Save role</button>
    </section>
  {/each}
</div>

