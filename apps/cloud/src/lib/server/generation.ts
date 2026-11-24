import { createHash } from 'node:crypto';
import type { Db } from '@mosaic-apps/server';
import type { ProjectBlueprint } from './groq';
import { id } from './db';

export interface GeneratedFile { path: string; content: string; mode?: string }

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'record';
}

function routeDirectory(path: string): string {
  // Planners write params as `:id`; SvelteKit needs `[id]` directories.
  const clean = path.split('?')[0]!.replace(/^\/+|\/+$/g, '').replace(/:(\w+)/g, '[$1]');
  return clean ? `src/routes/${clean.replace(/[^a-zA-Z0-9_\-/[\]]/g, '-')}` : 'src/routes';
}

// Model-written text lands in Svelte markup, where `{` starts an expression and `<` a tag.
export function svelteText(value: string): string {
  return value.replace(/[&<>{}]/g, (char) => `&#${char.charCodeAt(0)};`);
}

function pageSource(name: string, purpose: string, access: string): string {
  return `<svelte:head><title>${svelteText(name)}</title></svelte:head>

<section class="mx-auto max-w-5xl space-y-6 py-12">
  <div class="badge badge-outline">${svelteText(access)}</div>
  <h1 class="text-4xl font-bold tracking-tight">${svelteText(name)}</h1>
  <p class="max-w-2xl text-lg opacity-70">${svelteText(purpose)}</p>
</section>
`;
}

function migration(blueprint: ProjectBlueprint): string {
  if (!blueprint.entities.length) return '-- No persistent business entities were inferred.\n';
  return blueprint.entities.map((entity) => {
    const fields = entity.fields.map((field) => `  ${safeName(field.split(/[:\s]/)[0] ?? field)} text`).join(',\n');
    return `CREATE TABLE IF NOT EXISTS ${safeName(entity.name)} (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n${fields ? `${fields},\n` : ''}  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz NOT NULL DEFAULT now()\n);`;
  }).join('\n\n') + '\n';
}

export function generateProjectFiles(input: { name: string; slug: string; theme: string; blueprint: ProjectBlueprint }): GeneratedFile[] {
  const files: GeneratedFile[] = [
    { path: 'package.json', content: JSON.stringify({ name: input.slug, private: true, version: '0.1.0', type: 'module', scripts: { dev: 'vite dev', build: 'vite build', preview: 'vite preview', check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json' }, dependencies: { '@lucide/svelte': '^1.55.0', '@sveltejs/adapter-vercel': '^7.0.0', '@sveltejs/kit': '^3.0.1', 'svelte': '^5.57.2' }, devDependencies: { '@sveltejs/vite-plugin-svelte': '^7.0.0', '@tailwindcss/vite': '^4.3.5', 'daisyui': '^5.8.2', 'svelte-check': '^4.4.5', 'tailwindcss': '^4.3.5', 'typescript': '^6.0.3', 'vite': '^8.3.0' }, engines: { node: '>=22' } }, null, 2) + '\n' },
    { path: 'vite.config.ts', content: "import adapter from '@sveltejs/adapter-vercel';\nimport { sveltekit } from '@sveltejs/kit/vite';\nimport tailwindcss from '@tailwindcss/vite';\nimport { defineConfig } from 'vite';\nexport default defineConfig({ plugins: [tailwindcss(), sveltekit({ adapter: adapter({ runtime: 'nodejs22.x' }) })] });\n" },
    { path: 'tsconfig.json', content: JSON.stringify({ extends: '$app/tsconfig', compilerOptions: { allowJs: true, checkJs: true, esModuleInterop: true, skipLibCheck: true, strict: true, moduleResolution: 'bundler' } }, null, 2) + '\n' },
    { path: '.gitignore', content: 'node_modules/\n.svelte-kit/\nbuild/\n.vercel/\n.env\n.env.*\n!.env.example\n' },
    { path: '.env.example', content: 'DATABASE_URL=postgresql://user:password@host/database?sslmode=require\nMOSAIC_JWT_SECRET=replace-with-a-long-random-secret\n' },
    { path: 'src/app.html', content: '<!doctype html><html lang="en" data-theme="' + input.theme + '"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />%sveltekit.head%</head><body data-sveltekit-preload-data="hover"><div style="display: contents">%sveltekit.body%</div></body></html>\n' },
    { path: 'src/app.css', content: `@import "tailwindcss";\n@plugin "daisyui" { themes: ${input.theme} --default, light, dark; }\n@layer base { body { margin: 0; min-height: 100vh; font-family: Inter, ui-sans-serif, system-ui, sans-serif; } }\n` },
    { path: 'src/routes/+layout.svelte', content: `<script>import '../app.css'; let { children } = $props();</script>\n<header class="border-b border-base-300 bg-base-100"><nav class="navbar mx-auto max-w-6xl"><a class="btn btn-ghost text-lg" href="/">${svelteText(input.name)}</a></nav></header>\n<main class="min-h-[calc(100vh-4rem)] bg-base-200 px-5">{@render children()}</main>\n` },
    { path: 'src/routes/api/health/+server.ts', content: "import { json } from '@sveltejs/kit';\nexport const GET = () => json({ ok: true, service: '" + input.slug + "' });\n" },
    { path: 'migrations/001_initial.sql', content: migration(input.blueprint) },
    { path: 'mosaic/blueprint.json', content: JSON.stringify(input.blueprint, null, 2) + '\n' },
    { path: 'AGENTS.md', content: `# ${input.name} agent guide\n\nThis is a generated SvelteKit application. Keep routes in \`src/routes\`, business migrations in \`migrations\`, and the architecture contract in \`mosaic/blueprint.json\`. Run \`npm run check\` and \`npm run build\` before committing.\n` },
    { path: '.agents/skills/mosaic-app/SKILL.md', content: `# Mosaic app\n\nRead \`mosaic/blueprint.json\` before changing routes or data. Preserve normal SvelteKit conventions, physical PostgreSQL tables, the global DaisyUI theme, and the same-origin API. Validate with \`npm run check\` and \`npm run build\`.\n` },
    { path: 'README.md', content: `# ${input.name}\n\nGenerated by Mosaic Cloud from an editable application blueprint.\n\n## Develop\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Verify\n\n\`\`\`bash\nnpm run check\nnpm run build\n\`\`\`\n` },
  ];
  for (const route of input.blueprint.routes) {
    files.push({ path: `${routeDirectory(route.path)}/+page.svelte`, content: pageSource(route.path === '/' ? input.name : route.path.split('/').filter(Boolean).at(-1) ?? input.name, route.purpose, route.access) });
    files.push({ path: `mosaic/pages/${safeName(route.path === '/' ? 'home' : route.path)}.json`, content: JSON.stringify(route, null, 2) + '\n' });
  }
  return [...new Map(files.map((file) => [file.path, file])).values()].sort((a, b) => a.path.localeCompare(b.path));
}

export async function persistGeneratedRelease(db: Db, input: { projectId: string; name: string; slug: string; theme: string; blueprint: ProjectBlueprint }) {
  const files = generateProjectFiles(input);
  const checksum = createHash('sha256').update(files.map((file) => `${file.path}\0${file.content}`).join('\0')).digest('hex');
  const releaseId = id();
  await db.tx(async (tx) => {
    const versions = await tx.query<{ version: number }>('SELECT COALESCE(MAX(version), 0) + 1 AS version FROM cloud_releases WHERE project_id = $1', [input.projectId]);
    const version = Number(versions.rows[0]?.version ?? 1);
    await tx.query('INSERT INTO cloud_releases (id, project_id, version, status, checksum, file_count) VALUES ($1, $2, $3, $4, $5, $6)', [releaseId, input.projectId, version, 'ready', checksum, files.length]);
    for (const file of files) await tx.query('INSERT INTO cloud_release_files (release_id, path, content, mode) VALUES ($1, $2, $3, $4)', [releaseId, file.path, file.content, file.mode ?? '100644']);
  });
  return { id: releaseId, checksum, fileCount: files.length };
}
