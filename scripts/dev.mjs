import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const apiPort = Number(process.env.MOSAIC_API_PORT ?? '8787');
const studioPort = Number(process.env.STUDIO_PORT ?? process.env.PORT ?? '4173');
const apiUrl = (process.env.PUBLIC_API_URL ?? `http://127.0.0.1:${apiPort}`).replace(/\/$/, '');
const children = [];
let stopping = false;

function start(label, args, cwd, env = process.env) {
  const child = spawn(node, args, { cwd, env, stdio: 'inherit', windowsHide: true });
  child.label = label;
  children.push(child);
  child.on('error', (error) => {
    console.error(`[mosaic] ${label} failed to start:`, error);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`[mosaic] ${label} stopped (${signal ?? code ?? 'unknown'}); stopping the development stack`);
    stop(code && code !== 0 ? code : 1);
  });
  return child;
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  process.exitCode = exitCode;
}

async function waitForApi(child, timeoutMs = 120_000) {
  const healthUrl = `${apiUrl.replace(/\/api$/, '')}/api/health`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (stopping || (child && child.exitCode !== null)) throw new Error('The API process exited before becoming healthy.');
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1200) });
      if (response.ok) {
        console.log(`[mosaic] API healthy at ${healthUrl}`);
        return;
      }
    } catch { /* API is still booting; keep waiting until the startup deadline. */ }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }
  throw new Error(`The API did not become healthy at ${healthUrl} within ${timeoutMs / 1000} seconds.`);
}

async function apiIsHealthy() {
  const healthUrl = `${apiUrl.replace(/\/api$/, '')}/api/health`;
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1200) });
    return response.ok;
  } catch {
    return false;
  }
}

async function studioIsHealthy() {
  try {
    const [studio, proxiedApi] = await Promise.all([
      fetch(`http://127.0.0.1:${studioPort}/studio`, { signal: AbortSignal.timeout(1500) }),
      fetch(`http://127.0.0.1:${studioPort}/api/health`, { signal: AbortSignal.timeout(1500) }),
    ]);
    return studio.ok && proxiedApi.ok;
  } catch {
    return false;
  }
}

async function main() {
  const studioEnv = { ...process.env, PORT: String(studioPort), PUBLIC_API_URL: apiUrl };
  const existingApi = await apiIsHealthy();
  const api = process.env.PUBLIC_API_URL || existingApi
    ? null
    : start('API', ['--import', 'tsx', 'packages/server/src/dev.ts'], root, { ...process.env, PORT: String(apiPort) });
  if (existingApi) console.log(`[mosaic] reusing healthy API at ${apiUrl}`);
  await waitForApi(api);
  if (await studioIsHealthy()) {
    console.log(`[mosaic] Studio and its API proxy are already healthy at http://localhost:${studioPort}`);
    return;
  }
  console.log(`[mosaic] starting Studio at http://localhost:${studioPort}`);
  start('Studio', [resolve(root, 'node_modules/vite/bin/vite.js'), 'dev', '--host', '127.0.0.1', '--strictPort'], resolve(root, 'apps/studio'), studioEnv);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
main().catch((error) => {
  console.error('[mosaic] development stack startup failed:', error);
  stop(1);
});
