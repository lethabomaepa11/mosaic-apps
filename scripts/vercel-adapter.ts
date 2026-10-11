/** Keep Vercel function aliases buildable on Windows without elevated privileges. */
import adapter from '@sveltejs/adapter-vercel';
import fs from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import type { Adapter } from '@sveltejs/kit';

export function vercelAdapter(): Adapter {
  const original = adapter({ runtime: 'nodejs22.x' });
  return {
    ...original,
    async adapt(builder) {
      if (process.platform !== 'win32') return original.adapt(builder);
      const root = resolve('.vercel/output/functions');
      const symlink = fs.symlinkSync;
      // The upstream adapter creates directory aliases using file symlinks.
      // Only aliases fully inside this application's function output are changed.
      fs.symlinkSync = (target, destination, type) => {
        const output = resolve(String(destination));
        const input = resolve(dirname(output), String(target));
        if (output.startsWith(root + sep) && input.startsWith(root + sep) && fs.statSync(input).isDirectory()) {
          return symlink(input, output, 'junction');
        }
        return symlink(target, destination, type);
      };
      try { await original.adapt(builder); }
      finally { fs.symlinkSync = symlink; }
    },
  };
}
