import { Sandbox } from '@vercel/sandbox';
import type { AppFramework } from '../framework';
import type { CustomCode } from './custom-code';
import type { GeneratedFile } from './generation';

type BuildSandbox = Pick<Sandbox, 'writeFiles' | 'updateNetworkPolicy'> & {
  stop(): Promise<unknown>;
  runCommand(command: { cmd: string; args: string[]; signal: AbortSignal }): Promise<{
    exitCode: number; stderr(): Promise<string>; stdout(): Promise<string>;
  }>;
};
const createSandbox = () => Sandbox.create({
  persistent: false, timeout: 240_000,
  networkPolicy: { allow: ['registry.npmjs.org'] },
});

export class SandboxCheckError extends Error {}

const smokeScript = String.raw`
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const [framework, customEnabled] = process.argv.slice(2);
const custom = customEnabled === 'yes' ? JSON.parse(await readFile('mosaic/custom-workflow.json', 'utf8')) : null;
const origin = 'http://127.0.0.1:3301';
const credentials = { email: 'sandbox-admin@example.test', password: 'isolated-test-password-32' };
const server = spawn(process.execPath, framework === 'nextjs'
  ? ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3301']
  : ['apps/web/build/index.js'], { stdio: 'inherit', env: {
  ...process.env, NODE_ENV: 'production', DATABASE_URL: 'pglite://memory', SEED: 'true', SEED_DEMO: 'false',
  ORIGIN: origin, HOST: '127.0.0.1', PORT: '3301', MOSAIC_JWT_SECRET: 'isolated-verification-signing-key-32',
  ADMIN_EMAIL: credentials.email, ADMIN_PASSWORD: credentials.password,
} });
const request = (path, options) => fetch(origin + path, { signal: AbortSignal.timeout(5000), ...options });
try {
  let health;
  for (let attempt = 0; attempt < 40 && server.exitCode === null; attempt++) {
    health = await request('/api/health').catch(() => null);
    if (health?.ok) break;
    await sleep(500);
  }
  assert.equal(health?.status, 200, 'Server and database health must pass');
  assert.equal((await health.json()).data?.db, true);
  const post = (path, data, cookie) => request(path, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(cookie && { cookie }) }, body: JSON.stringify(data),
  });
  const login = await post('/api/auth/login', credentials);
  assert.equal(login.status, 200, 'Administrator sign-in must work');
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  assert.equal((await request('/', { headers: { cookie } })).status, 200, 'The application must serve its home page');
  if (custom) {
    const endpoint = '/api/extensions/custom-submit';
    const form = await request('/api/forms?published=true', { headers: { cookie } });
    assert.ok((await form.json()).data?.some((item) => item.entity === custom.entity && item.settings?.createEndpoint === '/extensions/custom-submit'), 'The published form must use the custom workflow');
    const anonymous = await post(endpoint, custom.input);
    assert.ok([401, 403].includes(anonymous.status), 'Anonymous calls must be rejected');
    async function userCookie(role, account) {
      const user = { email: account + '@example.test', password: credentials.password };
      assert.equal((await post('/api/users', { ...user, roles: [role] }, cookie)).status, 201);
      const response = await post('/api/auth/login', user);
      assert.equal(response.status, 200);
      const session = response.headers.get('set-cookie')?.split(';')[0];
      assert.ok(session);
      return session;
    }
    const roles = custom.allowedRoles;
    const open = roles.length === 0 || roles.includes('*');
    if (!open) {
      const denied = await userCookie('sandbox-denied', 'denied');
      assert.equal((await post(endpoint, custom.input, denied)).status, 403, 'A role outside the workflow must be denied');
    }
    const role = open ? 'viewer' : roles.find((role) => role !== 'admin');
    const actor = role ? await userCookie(role, 'workflow-user') : cookie;
    if (role) assert.equal((await post('/api/entities/' + custom.entity, custom.input, actor)).status, 403, 'Raw CRUD must not bypass the workflow');
    const invalid = await post(endpoint, custom.invalidInput, actor);
    assert.ok(invalid.status >= 400 && invalid.status < 500, 'Invalid input must be rejected with a 4xx response');
    const success = await post(endpoint, custom.input, actor);
    assert.equal(success.status, 201, 'The valid request must create a record or complete its action');
    const body = await success.json();
    assert.equal(body.success, true);
    assert.equal(typeof body.data?.id, 'string', 'The workflow must return the affected record ID');
    const persisted = await request('/api/entities/' + custom.entity + '/' + encodeURIComponent(body.data.id), { headers: { cookie } });
    assert.equal(persisted.status, 200, 'The affected record must exist in the database');
    const recorded = (await persisted.json()).data;
    for (const [key, value] of Object.entries(custom.expected)) {
      assert.deepEqual(body.data?.[key], value, 'Unexpected result field: ' + key);
      assert.deepEqual(recorded?.[key], value, 'Unexpected stored field: ' + key);
    }
  }
} finally { server.kill(); }
`;

export async function verifyReleaseInSandbox(input: {
  framework: AppFramework;
  baseline: GeneratedFile[];
  render: (custom: CustomCode | null) => GeneratedFile[];
  custom: CustomCode | null;
  repair: (previous: CustomCode, reason: string) => Promise<CustomCode | null>;
  status: (message: string) => Promise<void>;
}, create: () => Promise<BuildSandbox> = createSandbox): Promise<CustomCode | null> {
  const sandbox = await create().catch((cause: unknown) => {
    const message = cause instanceof Error ? cause.message : '';
    if (/credential|unauthorized|forbidden|401|403|oidc/i.test(message)) throw new Error('Vercel Sandbox could not authenticate. Check the Cloud project’s Sandbox access and OIDC configuration.');
    throw new Error('Vercel Sandbox could not start. Retry the build.');
  });
  const write = (files: GeneratedFile[]) => sandbox.writeFiles(files.map((file) => ({ path: file.path, content: Buffer.from(file.content) })));
  const run = async (label: string, cmd: string, args: string[]) => {
    const result = await sandbox.runCommand({ cmd, args, signal: AbortSignal.timeout(150_000) });
    if (result.exitCode !== 0) {
      const [stderr, stdout] = await Promise.all([result.stderr(), result.stdout()]);
      const logs = label === 'Svelte typecheck' ? [stdout, stderr] : [stderr, stdout];
      const reason = logs.map((log) => log.trim().slice(-1400)).filter(Boolean).join('\n');
      // Keep logs bounded. They are visible to the model as untrusted diagnostic evidence.
      throw new SandboxCheckError(`${label} failed (exit ${result.exitCode}). ${reason}`);
    }
  };
  try {
    await input.status('Installing the generated scaffold in Vercel Sandbox');
    await write(input.baseline);
    await run('Dependency install', 'npm', [input.framework === 'nextjs' ? 'ci' : 'install', '--no-audit', '--no-fund']);
    await sandbox.updateNetworkPolicy('deny-all');
    await write([{ path: 'mosaic/sandbox-check.mjs', content: smokeScript }]);
    let custom = input.custom;
    for (let attempt = 0; ; attempt++) {
      await input.status(attempt ? 'Rechecking the repaired custom workflow' : 'Building and testing the app in the isolated VM');
      if (custom) {
        const baseline = new Map(input.baseline.map((file) => [file.path, file.content]));
        await write(input.render(custom).filter((file) => baseline.get(file.path) !== file.content));
      }
      try {
        if (input.framework === 'sveltekit') await run('Svelte typecheck', 'npm', ['run', 'check']);
        await run('Production build', 'npm', ['run', 'build']);
        await run('Application smoke test', 'node', ['mosaic/sandbox-check.mjs', input.framework, custom ? 'yes' : 'no']);
        return custom;
      } catch (cause) {
        if (!custom || attempt >= 1 || !(cause instanceof SandboxCheckError)) throw cause;
        const repaired = await input.repair(custom, cause.message);
        if (!repaired || repaired.entity !== custom.entity) throw new Error(`The repair must preserve the selected custom workflow. ${cause.message}`);
        custom = repaired;
      }
    }
  } finally {
    await sandbox.stop().catch(() => {});
  }
}
