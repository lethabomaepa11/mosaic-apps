<script lang="ts">
  import { Icon, toast } from '@mosaic/ui';
  import type { AuditEntry, RefList, SettingRecord } from '@mosaic/core';
  import { client } from '#lib/client';

  async function removeRefList(name: string) {
    try {
      await client.deleteRefList(name);
      toast.success(`Removed ${name}`);
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : String(err));
    }
  }

  async function saveSetting(setting: SettingRecord & { updatedAt: string }) {
    try {
      await client.setSetting(setting.key, setting.value, setting.description);
      toast.success(`Setting ${setting.key} saved`);
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : String(err));
    }
  }

  interface Props {
    refLists: RefList[];
    settings: (SettingRecord & { updatedAt: string })[];
    audit: AuditEntry[];
    onsettings: (settings: (SettingRecord & { updatedAt: string })[]) => void;
    onrefreshreflists: () => void;
  }

  let { refLists, settings, audit, onsettings, onrefreshreflists }: Props = $props();
</script>

<h3 class="m-h4">Reference lists</h3>
<div class="cards" style="margin-bottom:24px">
  {#each refLists as list (list.name)}
    <section class="m-card">
      <div class="m-row" style="justify-content:space-between">
        <strong>{list.label ?? list.name}</strong>
        <button class="m-btn m-btn--ghost m-btn--icon" aria-label="Remove reference list" onclick={() => { removeRefList(list.name); onrefreshreflists(); }}><Icon name="x" size={14} /></button>
      </div>
      <div class="m-small m-muted" style="margin:6px 0"><code>{list.name}</code></div>
      <div class="m-row">
        {#each list.items as item (item.value)}
          <span class="m-badge" style={item.color ? `background:${item.color}1a;color:${item.color};border-color:transparent` : ''}>{item.label ?? item.value}</span>
        {/each}
      </div>
    </section>
  {/each}
</div>

<h3 class="m-h4">Settings</h3>
<section class="m-card" style="margin-bottom:24px">
  <table class="kv">
    <thead><tr><th>Key</th><th>Value (JSON)</th><th></th></tr></thead>
    <tbody>
      {#each settings as setting, i (setting.key)}
        <tr>
          <td><code>{setting.key}</code><div class="m-small m-muted">{setting.description ?? ''}</div></td>
          <td>
            <input
              class="m-input m-mono"
              value={typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value)}
              onchange={(e) => {
                const raw = (e.currentTarget as HTMLInputElement).value;
                let value: unknown = raw;
                try {
                  value = JSON.parse(raw);
                } catch {
                  /* keep as string */
                }
                const next = [...settings];
                next[i] = { ...setting, value };
                onsettings(next);
              }}
            />
          </td>
          <td><button class="m-btn m-btn--secondary m-btn--sm" onclick={() => saveSetting(settings[i]!)}>Save</button></td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<h3 class="m-h4">Audit log (latest 30)</h3>
<section class="m-card">
  <table class="kv">
    <thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Record</th><th>User</th></tr></thead>
    <tbody>
      {#each audit as entry (entry.id)}
        <tr>
          <td class="m-small">{new Date(entry.createdAt).toLocaleString()}</td>
          <td><span class="m-badge">{entry.action}</span></td>
          <td>{entry.entity ?? '—'}</td>
          <td class="m-mono m-small">{entry.recordId ? entry.recordId.slice(0, 8) + '…' : '—'}</td>
          <td class="m-small">{entry.userEmail ?? '—'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>
