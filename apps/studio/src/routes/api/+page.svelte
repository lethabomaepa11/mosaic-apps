<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from '@mosaic/ui';
  import type { EntityDef } from '@mosaic/core';
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
    path =
      method === 'GET' && !path.includes('/:id')
        ? `/entities/${selected}`
        : path || `/entities/${selected}`;
  });

  async function send() {
    busy = true;
    try {
      const token = client.token ?? '';
      const res = await fetch(`/api${path.startsWith('/') ? path : '/' + path}`, {
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
    <select class="m-select" style="width:180px" bind:value={selected} onchange={() => (path = `/entities/${selected}`)}>
      {#each entities as e (e.name)}<option value={e.name}>{e.name}</option>{/each}
    </select>
    <select class="m-select" style="width:120px" bind:value={method}>
      <option>GET</option><option>POST</option><option>PATCH</option><option>DELETE</option>
    </select>
    <input class="m-input" style="flex:1;min-width:280px" bind:value={path} placeholder="/entities/customer" />
    <button class="m-btn m-btn--primary" disabled={busy} onclick={send}>{busy ? 'Sending…' : 'Send'}</button>
  </div>
  {#if method !== 'GET'}
    <textarea class="m-textarea m-mono" rows="7" bind:value={body} spellcheck="false"></textarea>
  {/if}
  <div class="m-row" style="justify-content:space-between">
    <span class="m-small m-muted">Tip: add ?include=owner, ?page=2, ?sort=-createdAt, ?q=text</span>
    {#if status}<span class="m-badge" class:m-badge--success={status < 300} class:m-badge--danger={status >= 400}>HTTP {status}</span>{/if}
  </div>
  {#if response}<pre class="m-code">{response}</pre>{/if}
</section>
