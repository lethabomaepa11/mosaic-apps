export interface ProjectBlueprint {
  summary: string;
  routes: Array<{ path: string; purpose: string; access: 'public' | 'authenticated' | 'role-based' }>;
  entities: Array<{ name: string; purpose: string; fields: string[] }>;
  roles: string[];
  workflows: string[];
  implementationNotes: string[];
}

const BLUEPRINT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    routes: { type: 'array', items: { type: 'object', properties: {
      path: { type: 'string' }, purpose: { type: 'string' }, access: { type: 'string', enum: ['public', 'authenticated', 'role-based'] },
    }, required: ['path', 'purpose', 'access'], additionalProperties: false } },
    entities: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, purpose: { type: 'string' }, fields: { type: 'array', items: { type: 'string' } },
    }, required: ['name', 'purpose', 'fields'], additionalProperties: false } },
    roles: { type: 'array', items: { type: 'string' } },
    workflows: { type: 'array', items: { type: 'string' } },
    implementationNotes: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'routes', 'entities', 'roles', 'workflows', 'implementationNotes'],
  additionalProperties: false,
} as const;

export function createLocalBlueprint(prompt: string, includeHome: boolean, includeLogin: boolean): ProjectBlueprint {
  return {
    summary: prompt,
    routes: [
      ...(includeHome ? [{ path: '/', purpose: 'Application homepage', access: 'public' as const }] : []),
      ...(includeLogin ? [{ path: '/login', purpose: 'User sign-in', access: 'public' as const }] : []),
      { path: '/app', purpose: 'Primary authenticated workspace', access: 'authenticated' },
    ],
    entities: [], roles: ['admin', 'member'], workflows: [],
    implementationNotes: ['Local planning fallback; configure GROQ_API_KEY for AI domain planning.'],
  };
}

export async function planProject(input: {
  prompt: string; includeHome: boolean; includeLogin: boolean; uiSystem: string; uiTheme: string;
}): Promise<{ blueprint: ProjectBlueprint; model: string }> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const model = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b';
  if (!apiKey) {
    if (process.env.VERCEL) throw new Error('Groq project planning is not configured.');
    return { blueprint: createLocalBlueprint(input.prompt, input.includeHome, input.includeLogin), model: 'local-fallback' };
  }
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model, reasoning_effort: 'low',
      messages: [
        { role: 'system', content: 'You are Mosaic\'s senior application architect. Turn the brief into a concise, implementation-ready web application blueprint. Prefer physical business tables, clear route access, and ordinary enterprise UX. Do not invent external integrations unless the brief asks for them.' },
        { role: 'user', content: JSON.stringify(input) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'mosaic_project_blueprint', strict: true, schema: BLUEPRINT_SCHEMA } },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Groq project planning failed (${response.status}).`);
  const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned an empty project blueprint.');
  return { blueprint: JSON.parse(content) as ProjectBlueprint, model };
}
