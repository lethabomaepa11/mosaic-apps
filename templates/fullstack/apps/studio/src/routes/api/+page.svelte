<script lang="ts">
  import { onMount } from 'svelte';
  import { CodeEditorField, SelectField, TextField, toast } from '@mosaic-apps/ui';
  import type { EntityDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  let entities = $state<EntityDef[]>([]);
  let selected = $state('customer');
  let method = $state('GET');
  let path = $state('');
  let body = $state('{\n  "name": "API Explorer",\n  "email": "api@explorer.dev"\n}');
  let response = $state('');
  let status = $state(0);
  let busy = $state(false);

  onMount(async () => {
    try {
      const list = await client.listEntities();
      entities = list.map((e) => e.definition);
      if (entities.length) selected = entities[0]!.name;
    } catch (err) {
      toast.error('Could not load entities', err instanceof Error ? err.message : String(err));
    }
  });

  $effect(() => {
    if (!selected) return;
    path = `/entities/${selected}`;
  });

  async function send() {
    busy = true;
    try {
      const token = client.token ?? '';
      if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) throw new Error('Enter a path relative to the configured Mosaic API.');
      const res = await fetch(`${client.apiBase}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: method === 'GET' ? undefined : body || undefined,
      });
      status = res.status;
      response = JSON.stringify(await res.json(), null, 2);
    } catch (err) {
      status = 0;
      response = String(err);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>API explorer · Mosaic Studio</title></svelte:head>

<header class="app-header">
  <h1 class="m-h2" style="margin:0">API explorer</h1>
</header>

<section class="m-card m-stack">
  <div class="m-row">
    <SelectField label="Entity" value={selected} clearable={false} options={entities.map(entity => ({ value:entity.name, label:entity.label ?? entity.name }))} oninput={value => selected = value ?? ''} />
    <SelectField label="Method" value={method} clearable={false} options={['GET','POST','PUT','PATCH','DELETE'].map(value => ({value,label:value}))} oninput={value => method = value ?? 'GET'} />
    <TextField label="API path" bind:value={path} placeholder="/entities/customer" />
    <button class="m-btn m-btn--primary" disabled={busy} onclick={send}>{busy ? 'Sending…' : 'Send'}</button>
  </div>
  {#if method !== 'GET'}
    <CodeEditorField label="Request body" bind:value={body} language="json" validate={(raw) => { try { JSON.parse(raw); } catch (error) { return error instanceof Error ? error.message : 'Enter valid JSON'; } }} />
  {/if}
  <div class="m-row" style="justify-content:space-between">
    <span class="m-small m-muted">Tip: add ?include=owner, ?page=2, ?sort=-createdAt, ?q=text</span>
    {#if status}<span class="m-badge" class:m-badge--success={status < 300} class:m-badge--danger={status >= 400}>HTTP {status}</span>{/if}
  </div>
  {#if response}<CodeEditorField label="API response" value={response} language={status ? 'json' : 'plaintext'} readOnly />{/if}
</section>

