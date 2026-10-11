/** Identifier generation (url-safe, sortable-ish, crypto random). */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

/** Short unique id with optional prefix, e.g. `frm_k3f9a2x1`. */
export function newId(prefix?: string, size = 10): string {
  let out = '';
  const bytes = randomBytes(size);
  for (let i = 0; i < size; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return prefix ? `${prefix}_${out}` : out;
}

export function uuid(): string {
  return globalThis.crypto.randomUUID();
}

/** Turn any label into a slug: `Order Lines` -> `order-lines`. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'item';
}
