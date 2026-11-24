import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(resolve(project, '.env'))) process.loadEnvFile(resolve(project, '.env'));
const config = JSON.parse(readFileSync(resolve(project, 'mosaic.config.json'), 'utf8'));
const apiPort = Number(process.env.PORT ?? config.api?.port ?? 3001);
const webPort = Number(process.env.MOSAIC_WEB_PORT ?? config.web?.port ?? 3000);
const studioPort = Number(process.env.MOSAIC_STUDIO_PORT ?? config.studio?.port ?? 3002);
const targets = [
  { name: 'web', port: webPort, color: '\x1b[35m', workspace: 'apps/web' },
  { name: 'studio', port: studioPort, color: '\x1b[33m', workspace: 'apps/studio' },
];
const children = [];
let shuttingDown = false;

async function requireFreePort(target) {
  // Windows can bind an IPv6 wildcard while IPv4 already owns the same port.
  // Check both loopback interfaces explicitly before starting any service.
  for (const host of ['127.0.0.1', '::1']) {
    await new Promise((accept, reject) => {
      const socket = createServer();
      socket.once('error', (error) => {
        if (host === '::1' && ['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(error.code)) { accept(); return; }
        reject(new Error(
          `${target.name} port ${target.port} is unavailable (${error.code}). Stop the application using it, or set ${target.name === 'api' ? 'PORT' : target.name === 'web' ? 'MOSAIC_WEB_PORT' : 'MOSAIC_STUDIO_PORT'} in .env.`,
        ));
      });
      socket.listen({ port: target.port, host, exclusive: true }, () => socket.close(accept));
    });
  }
}

function startTarget(target) {
  const args = ['run', 'dev', '-w', target.workspace];
  const env = {
    ...process.env,
    PORT: String(apiPort),
    MOSAIC_WEB_PORT: String(webPort),
    MOSAIC_STUDIO_PORT: String(studioPort),
    MOSAIC_API_TARGET: `http://127.0.0.1:${webPort}`,
  };
  const options = { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' };
  const child = process.env.npm_execpath?.endsWith('npm-cli.js')
    ? spawn(process.execPath, [process.env.npm_execpath, ...args], options)
    : process.platform === 'win32'
      ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], options)
      : spawn('npm', args, options);
  children.push(child);
  const prefix = `${target.color}[${target.name}]\x1b[0m `;
  for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) output.write(prefix + line + '\n');
    });
    stream.on('end', () => { if (buffer) output.write(prefix + buffer + '\n'); });
  }
  child.on('error', (error) => { console.error(`${prefix}${error.message}`); shutdown(1); });
  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.error(`${prefix}exited with code ${code}`);
    shutdown(code ?? 1);
  });
  return child;
}

async function main() {
  const ports = targets.map((target) => target.port);
  if (ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535) || new Set(ports).size !== ports.length) {
    throw new Error('API, web and Studio ports must be different integers between 1 and 65535.');
  }
  for (const target of targets) await requireFreePort(target);
  const web = startTarget(targets[0]);
  const health = `http://127.0.0.1:${webPort}/api/health`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && !shuttingDown) {
    if (web.exitCode !== null) throw new Error('Application stopped before becoming ready.');
    try {
      const response = await fetch(health, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        console.log(`[mosaic] Application ready on :${webPort}; starting Studio on :${studioPort}`);
        startTarget(targets[1]);
        return;
      }
    } catch { /* The API may still be initializing its database. */ }
    await new Promise((ready) => setTimeout(ready, 300));
  }
  throw new Error(`Application did not become healthy at ${health}. Check DATABASE_URL and application logs.`);
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === 'win32') {
      try { child.kill(); } catch { /* The process may already have exited. */ }
      const killed = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true });
      if (killed.status !== 0) console.error(`[mosaic] Could not stop ${child.pid}: ${(killed.stderr || killed.stdout || 'taskkill failed').trim()}`);
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ }
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
main().catch((error) => { console.error('[mosaic]', error.message); shutdown(1); });
