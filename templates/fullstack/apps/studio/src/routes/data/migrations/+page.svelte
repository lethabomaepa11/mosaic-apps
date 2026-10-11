<script lang="ts">
  import { onMount } from 'svelte';
  import { CodeEditorField, Badge, Button, toast } from '@mosaic-apps/ui';
  import { client } from '#lib/client';

  interface Statement {
    sql: string;
    kind: string;
    risk: string;
    description: string;
  }

  interface HistoryRow {
    id: string;
    entity: string;
    entityVersion: number;
    checksum: string;
    statements: unknown[];
    status: string;
    error: string | null;
    appliedAt: string;
  }

  let plan = $state<{ plans: { entity: string; statements: Statement[]; warnings: string[]; empty: boolean }[]; statements: Statement[]; warnings: string[]; empty: boolean } | null>(null);
  let history = $state<HistoryRow[]>([]);
  let loading = $state(true);
  let applying = $state(false);

  onMount(refresh);

  async function refresh() {
    loading = true;
    try {
      plan = await client.planMigrations();
      history = await client.migrationHistory(100);
    } catch (err) {
      toast.error('Could not load migrations', err instanceof Error ? err.message : String(err));
    } finally {
      loading = false;
    }
  }

  async function apply() {
    applying = true;
    try {
      const res = await client.applyMigrations({ allowDestructive: true });
      toast.success(`Applied ${res.applied.reduce((n, a) => n + a.statements, 0)} statement(s)`);
      await refresh();
    } catch (err) {
      toast.error('Migration failed', err instanceof Error ? err.message : String(err));
    } finally {
      applying = false;
    }
  }
</script>

<svelte:head><title>Migrations · Mosaic Studio</title></svelte:head>

<header class="app-header">
  <div>
    <h1 class="m-h2" style="margin:0">Migrations</h1>
    <div class="m-muted m-small">Metadata-driven schema: preview SQL, then apply</div>
  </div>
  <div class="m-row">
    <button class="m-btn m-btn--secondary" onclick={refresh}>↻ Refresh</button>
    <button class="m-btn m-btn--primary" disabled={applying || !plan || plan.empty} onclick={apply}>
      {applying ? 'Applying…' : 'Apply pending migration'}
    </button>
  </div>
</header>

{#if loading}
  <div class="m-card"><span class="m-spinner"></span></div>
{:else if plan}
  {#if plan.empty}
    <div class="m-alert m-alert--success">Schema is up to date — nothing to migrate.</div>
  {:else}
    <section class="m-card" style="margin-bottom:18px">
      <header class="m-card__header"><strong>Pending plan</strong><span class="m-badge">{plan.statements.length} statement(s)</span></header>
      <CodeEditorField label="Migration SQL" value={plan.statements.map((s) => s.sql).join(';\n') + ';'} language="sql" readOnly />
      {#if plan.warnings.length}
        <div class="m-alert m-alert--warning" style="margin-top:10px">
          {#each plan.warnings as w (w)}<div>{w}</div>{/each}
        </div>
      {/if}
    </section>
  {/if}

  <section class="m-card">
    <header class="m-card__header"><strong>History</strong></header>
    <table class="kv">
      <thead><tr><th>When</th><th>Entity</th><th>Version</th><th>Statements</th><th>Status</th></tr></thead>
      <tbody>
        {#each history as row (row.id)}
          <tr>
            <td>{new Date(row.appliedAt).toLocaleString()}</td>
            <td><code>{row.entity}</code></td>
            <td>v{row.entityVersion}</td>
            <td>{Array.isArray(row.statements) ? row.statements.length : 0}</td>
            <td>
              {#if row.status === 'applied'}
                <span class="m-badge m-badge--success">applied</span>
              {:else}
                <span class="m-badge m-badge--danger" title={row.error ?? ''}>{row.status}</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

