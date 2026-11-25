import Anthropic from '@anthropic-ai/sdk';

/**
 * Structured-output client shared by the planner, developer and reviewer agents.
 * Default: Mosaic's shared Groq key. Users may bring their own OpenAI,
 * Anthropic (Claude) or DeepSeek key in their settings; jobs then run on that provider.
 */
export class AiError extends Error {}

export type AiProvider = 'mosaic' | 'openai' | 'anthropic' | 'deepseek' | 'gemini';
export interface AiConfig { provider: AiProvider; apiKey?: string; model?: string; onModel?: (model: string) => Promise<void> | void }

export const AI_PROVIDERS: Record<AiProvider, { label: string; defaultModel: string; keyUrl: string }> = {
  mosaic: { label: 'Mosaic default (shared Groq)', defaultModel: 'openai/gpt-oss-120b', keyUrl: '' },
  openai: { label: 'ChatGPT (OpenAI API)', defaultModel: 'gpt-5-mini', keyUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Claude (Anthropic API)', defaultModel: 'claude-opus-5-5', keyUrl: 'https://console.anthropic.com/settings/keys' },
  deepseek: { label: 'DeepSeek', defaultModel: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys' },
  gemini: { label: 'Gemini', defaultModel: 'gemini-3.5-flash-lite', keyUrl: 'https://aistudio.google.com/apikey' },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// shortcut: routing is local to this server instance, share counters if cross-instance throttling becomes frequent.
const sharedCooldowns = new Map<string, { until: number; limited: boolean }>();
const groqInFlight = new Map<string, number>();
const groqFallbacks = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

export function hasGeminiFallback(): boolean {
  return Boolean(process.env.GEMINI_FALLBACK_API_KEY?.trim());
}

function rateLimitError(provider: AiProvider, wait: number | null): AiError {
  const retry = wait === null ? 'Try again later.' : wait >= 60_000 ? `Try again in about ${Math.ceil(wait / 60_000)} min.` : `Try again in about ${Math.ceil(wait / 1000)}s.`;
  const service = provider === 'mosaic' ? (hasGeminiFallback() ? 'Shared AI' : 'Groq') : AI_PROVIDERS[provider].label;
  return new AiError(`${service} rate limit reached. ${retry}${provider === 'mosaic' ? ' You can also use your own key in Settings → AI.' : ''}`);
}

/** Reset headers can contain durations or a standard HTTP date. */
export function parseWait(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s?)?$/);
  const ms = match
    ? (Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)) * 1000
    : Date.parse(value) - Date.now();
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
  let value: unknown;
  try { value = JSON.parse(trimmed); } catch {
    const start = trimmed.indexOf('{'); const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { value = JSON.parse(trimmed.slice(start, end + 1)); } catch { /* Report a usable error below. */ }
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiError(`${name}: the model did not return a JSON object.`);
  return value as T;
}

export async function aiJson<T>(input: AiRequest & { config?: AiConfig }): Promise<T> {
  const config = input.config ?? { provider: 'mosaic' as const };
  if (config.provider === 'anthropic') return anthropicJson<T>(input, config);
  if (config.provider === 'mosaic') return sharedJson<T>(input, config);
  if (config.provider === 'gemini') {
    if (!config.apiKey) throw new AiError('Add your Gemini key in Settings → AI.');
    const preferred = aiModel(config);
    const fallback = preferred === 'gemini-3.1-flash-lite' ? AI_PROVIDERS.gemini.defaultModel : 'gemini-3.1-flash-lite';
    let failure: AiError | undefined;
    let transient = false;
    for (const model of [preferred, fallback]) {
      const result = await geminiReply<T>(input, model, config.apiKey, AbortSignal.timeout(20_000)).catch(() => null);
      if (result?.ok) {
        await config.onModel?.(result.model);
        return result.value;
      }
      if (!result) {
        transient = true;
        failure = new AiError('Gemini did not return a usable response. Try again shortly.');
        continue;
      }
      const { response } = result;
      await response.body?.cancel().catch(() => {});
      if (response.status === 429 || response.status >= 500) {
        transient = true;
        failure = response.status === 429 ? rateLimitError('gemini', parseWait(response.headers.get('retry-after')))
          : new AiError(`Gemini is temporarily unavailable (${response.status}). Try again shortly.`);
      } else if (response.status === 404) {
        failure ??= new AiError('This Gemini model is unavailable to your account. Check the model in Settings → AI.');
      }
      else throw new AiError(`Gemini rejected the request (${response.status}). Check your key and model in Settings → AI.`);
    }
    if (transient && process.env.GROQ_API_KEY?.trim()) {
      return sharedJson<T>(input, { provider: 'mosaic', onModel: config.onModel }, true);
    }
    throw failure ?? new AiError('Gemini is temporarily unavailable.');
  }
  return chatCompletionsJson<T>(input, config);
}

type AiReply<T> = { ok: true; value: T; model: string } | { ok: false; response: Response };

async function chatReply<T>(input: AiRequest, url: string, key: string, body: object, model: string, signal: AbortSignal): Promise<AiReply<T>> {
  const response = await fetch(url, {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body), signal,
  });
  if (!response.ok) return { ok: false, response };
  const result = await response.json() as { model?: string; choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
  const choice = result.choices?.[0];
  if (!choice?.message?.content || choice.finish_reason === 'length') throw new AiError(`${input.name}: the model returned an empty or incomplete answer.`);
  return { ok: true, value: parseJson<T>(input.name, choice.message.content), model: result.model ?? model };
}

async function geminiReply<T>(input: AiRequest, model: string, key: string, signal: AbortSignal): Promise<AiReply<T>> {
  const response = await fetch(`${geminiUrl}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: 'user', parts: [{ text: input.user }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: input.schema, maxOutputTokens: input.maxTokens ?? 8192 },
    }),
  });
  if (!response.ok) return { ok: false, response };
  const result = await response.json() as { modelVersion?: string; candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
  const candidate = result.candidates?.[0];
  const content = candidate?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? '').join('');
  if (!content || candidate?.finishReason !== 'STOP') throw new AiError(`${input.name}: Gemini returned an empty or incomplete answer.`);
  return { ok: true, value: parseJson<T>(input.name, content), model: result.modelVersion ?? model };
}

/** Try each available shared model at most once before returning a useful failure. */
async function sharedJson<T>(input: AiRequest, config: AiConfig, groqOnly = false): Promise<T> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const geminiKey = groqOnly ? undefined : process.env.GEMINI_FALLBACK_API_KEY?.trim();
  const active = (model: string) => groqInFlight.get(model) ?? 0;
  const groq = groqKey ? [...new Set([aiModel(config), ...groqFallbacks])].sort((a, b) => active(a) - active(b)) : [];
  const gemini = AI_PROVIDERS.gemini.defaultModel;
  const models = [...groq, ...(geminiKey ? [gemini] : [])];
  if (!models.length) throw new AiError('Shared AI is unavailable. Add a provider key in Settings → AI.');
  const ready = (model: string) => (sharedCooldowns.get(model)?.until ?? 0) <= Date.now();
  for (const model of models) {
    if (!ready(model)) continue;
    const signal = AbortSignal.timeout(45_000);
    const usesGemini = model === gemini && Boolean(geminiKey);
    if (!usesGemini) groqInFlight.set(model, active(model) + 1);
    let reply: AiReply<T>;
    try {
      reply = usesGemini ? await geminiReply<T>(input, model, geminiKey!, signal) : await chatReply<T>(input, groqUrl, groqKey!, {
        model, messages: [{ role: 'system', content: input.system }, { role: 'user', content: input.user }],
        response_format: { type: 'json_schema', json_schema: { name: input.name, strict: input.strict ?? true, schema: input.schema } },
        max_completion_tokens: input.maxTokens ?? 6000,
        ...(groqFallbacks.includes(model) ? { reasoning_effort: 'low' } : {}),
      }, model, signal);
    } catch {
      sharedCooldowns.set(model, { until: Date.now() + 5_000, limited: false });
      continue;
    } finally {
      if (!usesGemini) groqInFlight.set(model, active(model) - 1);
    }
    if (reply.ok) {
      await config.onModel?.(reply.model);
      return reply.value;
    }
    const { response } = reply;
    const limited = response.status === 429;
    const wait = parseWait(response.headers.get('retry-after')) ?? parseWait(response.headers.get('x-ratelimit-reset-tokens'));
    sharedCooldowns.set(model, { until: Date.now() + (limited ? (wait ?? 10_000) + 250 : response.status === 401 || response.status === 403 ? 60_000 : 5_000), limited });
    await response.body?.cancel().catch(() => {});
  }
  const cooldowns = models.map((model) => sharedCooldowns.get(model));
  if (cooldowns.every((item) => item?.limited)) {
    throw rateLimitError('mosaic', Math.max(1, Math.min(...cooldowns.map((item) => item!.until)) - Date.now()));
  }
  throw new AiError('Shared AI could not complete this step. Try again shortly or use your own provider in Settings → AI.');
}

/** OpenAI and DeepSeek share the chat-completions shape. */
async function chatCompletionsJson<T>(input: AiRequest, config: AiConfig): Promise<T> {
  const target = config.provider === 'openai' ? { url: 'https://api.openai.com/v1/chat/completions', key: config.apiKey }
    : { url: 'https://api.deepseek.com/chat/completions', key: config.apiKey };
  if (!target.key) throw new AiError(`Add your ${AI_PROVIDERS[config.provider].label} key in Settings → AI.`);
  const model = aiModel(config);
  // DeepSeek supports JSON mode but not JSON schemas, so the schema travels in the prompt.
  const schemaInPrompt = config.provider === 'deepseek';
  const system = schemaInPrompt ? `${input.system}\n\nReply with one JSON object only, matching this JSON Schema:\n${JSON.stringify(input.schema)}` : input.system;
  let user = input.user;
  let lastError = '';
  let schemaRetries = 0;
  let retriedRateLimit = false;
  // Rate-limit waits do not use up the schema retries.
  for (let attempt = 0; attempt < 14; attempt++) {
    const body: Record<string, unknown> = {
      model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: schemaInPrompt ? { type: 'json_object' } : { type: 'json_schema', json_schema: { name: input.name, strict: input.strict ?? true, schema: input.schema } },
    };
    if (config.provider === 'openai') body.max_completion_tokens = Math.max(input.maxTokens ?? 6000, 16000);
    else body.max_tokens = Math.min(Math.max(input.maxTokens ?? 6000, 8000), 8192);
    const reply = await chatReply<T>(input, target.url, target.key, body, model, AbortSignal.timeout(180_000));
    if (reply.ok) {
      await config.onModel?.(reply.model);
      return reply.value;
    }
    const { response } = reply;
    const text = await response.text().catch(() => '');
    lastError = `${input.name} failed (${response.status}): ${text.slice(0, 400)}`;
    if (response.status === 401 || response.status === 403) throw new AiError(`Your ${AI_PROVIDERS[config.provider].label} key was rejected (${response.status}). Update it in Settings → AI.`);
    if (response.status === 429) {
      const wait = parseWait(response.headers.get('retry-after')) ?? parseWait(response.headers.get('x-ratelimit-reset-tokens'));
      if (retriedRateLimit || wait === null || wait > 10_000) {
        throw rateLimitError(config.provider, wait);
      }
      retriedRateLimit = true;
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
    const parsed = parseJson<T>(input.name, text);
    await config.onModel?.(message.model ?? aiModel(config));
    return parsed;
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
  if (provider === 'gemini') {
    const response = await fetch(geminiUrl, { headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(15_000) });
    await response.body?.cancel();
    if (!response.ok) throw new AiError(`The key was rejected (${response.status}).`);
    return;
  }
  const url = provider === 'openai' ? 'https://api.openai.com/v1/models' : 'https://api.deepseek.com/models';
  const response = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new AiError(`The key was rejected (${response.status}).`);
}
