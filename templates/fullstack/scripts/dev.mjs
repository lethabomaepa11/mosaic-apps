import { spawn } from "node:child_process";

const targets = [
  { name: "api", color: "\x1b[36m", args: ["run", "dev", "-w", "@__PROJECT_SLUG__/api"] },
  { name: "web", color: "\x1b[35m", args: ["run", "dev", "-w", "@__PROJECT_SLUG__/web"] },
  { name: "studio", color: "\x1b[33m", args: ["run", "dev", "-w", "@__PROJECT_SLUG__/studio"] },
];

const reset = "\x1b[0m";
const children = [];
let shuttingDown = false;

function startTarget(t) {
  const child = spawn(`npm ${t.args.join(" ")}`, { stdio: ["ignore", "pipe", "pipe"], shell: true });
  children.push(child);

  const prefix = `${t.color}[${t.name}]${reset} `;
  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code) => {
    if (shuttingDown) return;
    console.log(`${prefix}exited with code ${code}`);
    shutdown(code ?? 1);
  });
}

async function main() {
  startTarget(targets[0]);
  const health = 'http://127.0.0.1:__API_PORT__/api/health';
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(health, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        console.log(`[mosaic] API ready; starting web (:__WEB_PORT__) and Studio (:3002)`);
        startTarget(targets[1]);
        startTarget(targets[2]);
        return;
      }
    } catch { /* API may still be initializing its database. */ }
    await new Promise((resolveReady) => setTimeout(resolveReady, 300));
  }
  throw new Error(`API did not become healthy at ${health}. Check DATABASE_URL and API logs.`);
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
main().catch((error) => { console.error('[mosaic]', error.message); shutdown(1); });
