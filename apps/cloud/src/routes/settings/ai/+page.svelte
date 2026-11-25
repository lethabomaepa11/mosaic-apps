<script lang="ts">
  import { enhance } from '$app/forms';
  import { Check, Gauge, KeyRound, Sparkles } from '@lucide/svelte';
  let { data, form } = $props();
  // svelte-ignore state_referenced_locally
  let provider = $state(data.settings.provider); // editable form state, seeded from the saved choice
  const providers = [
    { id: 'mosaic', name: 'Mosaic default', tag: 'Free', note: 'Groq · gpt-oss-120b' },
    { id: 'openai', name: 'ChatGPT', tag: 'Your key', note: 'OpenAI API' },
    { id: 'anthropic', name: 'Claude', tag: 'Your key', note: 'Anthropic API' },
    { id: 'deepseek', name: 'DeepSeek', tag: 'Your key', note: 'DeepSeek API' },
  ] as const;
  const keyHelp: Record<string, { url: string; text: string }> = {
    openai: { url: 'https://platform.openai.com/api-keys', text: 'A ChatGPT Plus or Pro subscription does not include API access. Create an API key on the OpenAI platform; usage there is billed separately.' },
    anthropic: { url: 'https://console.anthropic.com/settings/keys', text: 'A Claude Pro or Max subscription does not include API access. Create an API key in the Anthropic Console. The default is Claude Opus 5.5 (best quality); claude-sonnet-5-5 or claude-haiku-5-5 cost less.' },
    deepseek: { url: 'https://platform.deepseek.com/api_keys', text: 'A low-cost API. Create a key on the DeepSeek platform.' },
  };
</script>

<svelte:head><title>AI · Mosaic Cloud</title><meta name="description" content="Choose which AI builds your Mosaic apps." /></svelte:head>

<section class="mx-auto max-w-3xl space-y-6">
  <header>
    <nav class="mb-5 flex gap-1" aria-label="Settings"><a class="tab-link" href="/settings/connections">Connections</a><a class="tab-link" href="/settings/ai" aria-current="page">AI</a></nav>
    <h1 class="mb-2 text-2xl font-semibold tracking-tight">AI that builds your apps</h1>
    <p class="mb-0 leading-7 muted">Pick the model behind the planner, developer and reviewer agents. Your key is checked, encrypted, and only used server-side for your own builds.</p>
  </header>

  {#if form?.message}<div class={`alert text-sm ${form.saved ? 'alert-success' : 'alert-error'}`} role="status">{form.message}</div>{/if}

  <form method="POST" action="?/save" use:enhance class="space-y-4">
    <div class="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="AI provider">
      {#each providers as item}
        <label class={`surface flex cursor-pointer items-start gap-3 p-4 transition ${provider === item.id ? 'border-primary ring-4 ring-primary/10' : 'hover:border-primary/40'}`}>
          <input class="radio radio-primary radio-sm mt-0.5" type="radio" name="provider" value={item.id} bind:group={provider} />
          <span class="min-w-0"><span class="flex items-center gap-2 font-medium">{item.name}<span class={`badge badge-sm ${item.id === 'mosaic' ? 'badge-success badge-soft' : 'badge-ghost'}`}>{item.tag}</span>{#if data.settings.provider === item.id}<Check size={14} class="text-success" />{/if}</span><span class="text-xs muted">{item.note}</span></span>
        </label>
      {/each}
    </div>

    {#if provider === 'mosaic'}
      <div class="surface space-y-2 p-4 text-sm">
        <p class="mb-0 flex items-center gap-2 font-medium"><Gauge size={16} class="text-warning" /> What to expect from the free default</p>
        <ul class="mb-0 list-disc space-y-1 pl-5 muted">
          <li>Runs on Groq's free tier, <strong>shared by everyone</strong> on this Cloud: about <strong>8,000 tokens per minute</strong> and <strong>1,000 requests per day</strong>.</li>
          <li>A build makes 4 to 10 AI calls, so it usually takes <strong>3 to 6 minutes</strong>, longer when others are building. You'll see "waiting for the AI rate limit" in the chat when that happens.</li>
          <li>If the daily limit runs out, builds pause until it resets. Quality is good for straightforward business apps; your own key gives faster, stronger results.</li>
        </ul>
      </div>
    {:else}
      <div class="surface space-y-4 p-4">
        <p class="mb-0 flex items-start gap-2 text-sm muted"><Sparkles size={16} class="mt-0.5 shrink-0 text-primary" /><span>{keyHelp[provider]?.text} <a class="link link-primary" href={keyHelp[provider]?.url} target="_blank" rel="noreferrer">Get a key</a></span></p>
        <label class="block text-sm font-medium">API key
          <input class="input input-bordered mt-1 w-full" name="apiKey" type="password" autocomplete="off" placeholder={data.settings.provider === provider && data.settings.hasKey ? 'Saved. Paste a new key to replace it' : 'Paste your API key'} />
        </label>
        <label class="block text-sm font-medium">Model <span class="font-normal muted">(optional)</span>
          <input class="input input-bordered mt-1 w-full font-mono text-sm" name="model" value={data.settings.provider === provider ? data.settings.model : ''} placeholder={data.defaults[provider]} />
        </label>
        <p class="mb-0 flex items-center gap-1.5 text-xs muted"><KeyRound size={12} /> Builds use your provider's rate limits and are billed to your account there.</p>
      </div>
    {/if}
    <div class="flex justify-end"><button class="btn btn-primary" type="submit">Save</button></div>
  </form>
</section>
