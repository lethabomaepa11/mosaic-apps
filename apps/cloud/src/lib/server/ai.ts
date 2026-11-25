import Anthropic from '@anthropic-ai/sdk';

/**
 * Structured-output client shared by the planner, developer and reviewer agents.
 * Default: Mosaic's Groq key (gpt-oss-120b, free tier). Users may bring their own OpenAI,
 * Anthropic (Claude) or DeepSeek key in their settings; jobs then run on that provider.
 */
export class AiError extends Error {}

export type AiProvider = 'mosaic' | 'openai' | 'anthropic' | 'deepseek';
export interface AiConfig { provider: AiProvider; apiKey?: string; model?: string }

export const AI_PROVIDERS: Record<AiProvider, { label: string; defaultModel: string; keyUrl: string }> = {
  mosaic: { label: 'Mosaic default (Groq gpt-oss-120b)', defaultModel: 'openai/gpt-oss-120b', keyUrl: '' },
  openai: { label: 'ChatGPT (OpenAI API)', defaultModel: 'gpt-5-mini', keyUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Claude (Anthropic API)', defaultModel: 'claude-opus-5-5', keyUrl: 'https://console.anthropic.com/settings/keys' },
  deepseek: { label: 'DeepSeek', defaultModel: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys' },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Groq/OpenAI report waits as "7.66s", "1m2.5s" or plain seconds. */
export function parseWait(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(?:(\d+)m)?(?:([\d.]+)s?)?$/);
  if (!match) return null;
  const ms = (Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)) * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

export function aiModel(config?: AiConfig): string {
  if (config && config.provider !== 'mosaic') return config.model?.trim() || AI_PROVIDERS[config.provider].defaultModel;
  return process.env.GROQ_MODEL?.trim() || AI_PROVIDERS.mosaic.defaultModel;
}

interface AiRequest { name: string; system: string; user: string; schema: object; strict?: boolean; maxTokens?: number; onWait?: (seconds: number) => Promise<void> | void }

/** Pulls the JSON object out of a reply, tolerating code fences or a sentence around it. */
function parseJson<T>(name: string, content: string): T {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(trimmed) as T; } catch {
    const start = trimmed.indexOf('{'); const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
    throw new AiError(`${name}: the model did not return JSON.`);
  }
}

export async function aiJson<T>(input: AiRequest & { config?: AiConfig }): Promise<T> {
  const config = input.config ?? { provider: 'mosaic' as const };
  if (config.provider === 'anthropic') return anthropicJson<T>(input, config);
  return chatCompletionsJson<T>(input, config);
}

/** Groq, OpenAI and DeepSeek share the chat-completions shape. */
async function chatCompletionsJson<T>(input: AiRequest, config: AiConfig): Promise<T> {
  const target = config.provider === 'openai' ? { url: 'https://api.openai.com/v1/chat/completions', key: config.apiKey }
    : config.provider === 'deepseek' ? { url: 'https://api.deepseek.com/chat/completions', key: config.apiKey }
    : { url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY?.trim() };
  if (!target.key) throw new AiError(config.provider === 'mosaic' ? 'GROQ_API_KEY is not configured, so the AI agents cannot run.' : `Add your ${AI_PROVIDERS[config.provider].label} key in Settings → AI.`);
  const model = aiModel(config);
  // DeepSeek supports JSON mode but not JSON schemas, so the schema travels in the prompt.
  const schemaInPrompt = config.provider === 'deepseek';
  const system = schemaInPrompt ? `${input.system}\n\nReply with one JSON object only, matching this JSON Schema:\n${JSON.stringify(input.schema)}` : input.system;
  let user = input.user;
  let lastError = '';
  let schemaRetries = 0;
  // Rate-limit waits do not use up the schema retries.
  for (let attempt = 0; attempt < 14; attempt++) {
    const body: Record<string, unknown> = {
      model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: schemaInPrompt ? { type: 'json_object' } : { type: 'json_schema', json_schema: { name: input.name, strict: input.strict ?? true, schema: input.schema } },
    };
    if (config.provider === 'mosaic') Object.assign(body, { reasoning_effort: 'low', max_completion_tokens: input.maxTokens ?? 6000 });
    else if (config.provider === 'openai') body.max_completion_tokens = Math.max(input.maxTokens ?? 6000, 16000);
    else body.max_tokens = Math.min(Math.max(input.maxTokens ?? 6000, 8000), 8192);
    const response = await fetch(target.url, {
      method: 'POST', headers: { authorization: `Bearer ${target.key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(180_000),
    });
    if (response.ok) {
      const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new AiError(`${input.name}: the model returned an empty answer.`);
      return parseJson<T>(input.name, content);
    }
    const text = await response.text().catch(() => '');
    lastError = `${input.name} failed (${response.status}): ${text.slice(0, 400)}`;
    if (response.status === 401 || response.status === 403) throw new AiError(`Your ${AI_PROVIDERS[config.provider].label} key was rejected (${response.status}). Update it in Settings → AI.`);
    if (response.status === 429) {
      const wait = Math.min(parseWait(response.headers.get('retry-after')) ?? parseWait(response.headers.get('x-ratelimit-reset-tokens')) ?? 10_000, 65_000);
      await input.onWait?.(Math.ceil(wait / 1000));
      await sleep(wait + 250);
      continue;
    }
    if (response.status === 400 && /json_validate_failed|does not match the expected schema|failed_generation/i.test(text) && schemaRetries++ < 3) {
      // Tell the model exactly what broke; strict mode rejects the whole drifted answer.
      user = `${input.user}\n\nYour previous answer was rejected: ${text.slice(0, 300)}\nReturn JSON that matches the schema exactly.`;
      continue;
    }
    if (response.status >= 500 && attempt < 4) { await sleep(2000 * (attempt + 1)); continue; }
    break;
  }
  throw new AiError(lastError);
}

/** Claude via the official SDK, with structured output and server-side refusal fallback. */
async function anthropicJson<T>(input: AiRequest, config: AiConfig): Promise<T> {
  if (!config.apiKey) throw new AiError('Add your Claude (Anthropic API) key in Settings → AI.');
  const client = new Anthropic({ apiKey: config.apiKey });
  // Strict schemas use structured output; the large app spec (which allows free-form sample
  // records) is requested as JSON in the prompt and normalised by the caller.
  const structured = input.strict ?? true;
  try {
    const message = await client.beta.messages.create({
      model: aiModel(config),
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: structured ? { effort: 'medium', format: { type: 'json_schema', schema: input.schema as Record<string, unknown> } } : { effort: 'medium' },
      system: structured ? input.system : `${input.system}\n\nReply with one JSON object only, matching this JSON Schema:\n${JSON.stringify(input.schema)}`,
      messages: [{ role: 'user', content: input.user }],
    });
    if (message.stop_reason === 'refusal') throw new AiError(`${input.name}: Claude declined this request.`);
    const text = message.content.filter((block) => block.type === 'text').map((block) => (block as { text: string }).text).join('');
    if (!text) throw new AiError(`${input.name}: Claude returned an empty answer.`);
    return parseJson<T>(input.name, text);
  } catch (cause) {
    if (cause instanceof Anthropic.AuthenticationError || cause instanceof Anthropic.PermissionDeniedError) throw new AiError('Your Claude (Anthropic API) key was rejected. Update it in Settings → AI.');
    if (cause instanceof Anthropic.RateLimitError) throw new AiError('Claude rate limit reached for your key. Try again shortly.');
    throw cause;
  }
}

/** Cheap credential check used when a user saves a key (lists models; spends no tokens). */
export async function testAiKey(provider: Exclude<AiProvider, 'mosaic'>, apiKey: string): Promise<void> {
  if (provider === 'anthropic') {
    await new Anthropic({ apiKey }).models.list({ limit: 1 });
    return;
  }
  const url = provider === 'openai' ? 'https://api.openai.com/v1/models' : 'https://api.deepseek.com/models';
  const response = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new AiError(`The key was rejected (${response.status}).`);
}
