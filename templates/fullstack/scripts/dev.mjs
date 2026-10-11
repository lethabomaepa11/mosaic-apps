import { spawn } from "node:child_process";

const targets = [
  { name: "api", color: "\x1b[36m", args: ["run", "dev", "-w", "@__PROJECT_SLUG__/api"] },
  { name: "web", color: "\x1b[35m", args: ["run", "dev", "-w", "@__PROJECT_SLUG__/web"] },
];

const reset = "\x1b[0m";
const children = [];
let shuttingDown = false;

for (const t of targets) {
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
