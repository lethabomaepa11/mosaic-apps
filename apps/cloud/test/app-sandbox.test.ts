import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { verifyReleaseInSandbox } from '../src/lib/server/app-sandbox';
import type { CustomCode } from '../src/lib/server/custom-code';
import { generateProjectFiles } from '../src/lib/server/generation';
import { compileSpec } from '../src/lib/server/spec';
import { equipmentSpec } from './fixtures/equipment-spec';

const custom: CustomCode = {
  entity: 'employee',
  source: `/** @param {{ db: import('@mosaic-apps/server').Db, input: Record<string, unknown> }} context */
  export async function handle({ db, input }) {
    const { fullName } = input;
    if (typeof fullName !== 'string' || !fullName.trim()) return new Response(null, { status: 400 });
    const result = await db.query('INSERT INTO employee ("id", "fullName") VALUES ($1, $2) RETURNING *',
      [crypto.randomUUID(), fullName.trim()]);
    return Response.json({ success: true, data: result.rows[0] }, { status: 201 });
  }`,
  input: { fullName: '  Test Employee  ' },
  invalidInput: { fullName: '' },
  expected: { fullName: 'Test Employee' },
};

function input(framework: 'sveltekit' | 'nextjs') {
  const spec = structuredClone(equipmentSpec);
  spec.entities[0].permissions.create = ['staff'];
  const app = compileSpec(spec);
  const render = (candidate: typeof custom | null) => generateProjectFiles({
    name: spec.name, slug: 'equipment-loans', framework, spec, app, custom: candidate,
  });
  return { framework, baseline: render(null), render, custom, repair: async () => null, status: async () => {} };
}

for (const framework of ['sveltekit', 'nextjs'] as const) {
  test(`${framework} release connects the form, documents the endpoint and restricts raw writes`, () => {
    const { render } = input(framework);
    const files = new Map(render(custom).map(({ path, content }) => [path, content]));
    const server = framework === 'nextjs' ? 'lib' : 'apps/web/src/lib/server';
    const entities = framework === 'nextjs' ? 'entities' : `${server}/entities`;
    const manifest = JSON.parse(files.get(`${server}/mosaic-app.json`)!);
    assert.equal(manifest.forms.find((item: { entity: string }) => item.entity === custom.entity).settings.createEndpoint, '/extensions/custom-submit');
    assert.deepEqual(JSON.parse(files.get(`${entities}/employee.entity.json`)!).permissions.create, ['admin']);
    const endpointsPath = `${server}/endpoints.${framework === 'nextjs' ? 'js' : 'ts'}`;
    const endpoints = files.get(endpointsPath)!;
    assert.match(endpoints, /\["staff"\]/);
    assert.deepEqual(ts.transpileModule(endpoints, { fileName: endpointsPath, reportDiagnostics: true }).diagnostics ?? [], []);
    assert.equal(files.get(`${server}/custom-workflow.js`), custom.source);
    assert.ok(JSON.parse(files.get('mosaic/openapi.json')!).paths['/extensions/custom-submit'].post);
  });

  test(`${framework} builds and verifies a persisted custom workflow in Vercel`, {
    skip: process.env.MOSAIC_TEST_VERCEL_SANDBOX !== '1',
  }, async () => {
    const result = await verifyReleaseInSandbox({ ...input(framework), status: async (message) => { console.log(message); } });
    assert.deepEqual(result, custom);
  });
}

test('sandbox cuts off the network before writing custom code, verifies a repair and always stops', async () => {
  const operations: string[] = [];
  let denied = false;
  let smokeChecks = 0;
  const create: NonNullable<Parameters<typeof verifyReleaseInSandbox>[1]> = async () => ({
    async writeFiles(files) {
      if (files.some(({ path }) => path.endsWith('/custom-workflow.js'))) {
        assert.equal(denied, true);
        operations.push('write workflow');
      }
    },
    async updateNetworkPolicy(policy) {
      assert.equal(policy, 'deny-all');
      denied = true;
      operations.push('network denied');
      return policy;
    },
    async runCommand(command) {
      const step = command.args[0] ?? '';
      operations.push(step);
      const failedSmoke = command.cmd === 'node' && ++smokeChecks === 1;
      return { exitCode: failedSmoke ? 1 : 0, stderr: async () => 'wrong stored value', stdout: async () => '' };
    },
    async stop() { operations.push('stop'); },
  });
  const repaired = { ...custom, source: custom.source + '\n' };
  const result = await verifyReleaseInSandbox({
    ...input('nextjs'),
    repair: async (previous, failure) => {
      assert.equal(previous, custom);
      assert.match(failure, /wrong stored value/);
      return repaired;
    },
  }, create);
  assert.equal(result, repaired);
  assert.deepEqual(operations, ['ci', 'network denied', 'write workflow', 'run', 'mosaic/sandbox-check.mjs', 'write workflow', 'run', 'mosaic/sandbox-check.mjs', 'stop']);

  smokeChecks = 0;
  await assert.rejects(verifyReleaseInSandbox(input('nextjs'), create), /repair must preserve/i);
  assert.equal(operations.at(-1), 'stop');
});
