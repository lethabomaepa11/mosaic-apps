#!/usr/bin/env node
/**
 * Generates PWA icons (192/512/maskable) as real PNGs — no binary assets needed.
 * Usage: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'static');

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function png(width, height, pixelFn) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y, width, height);
      raw.push(r, g, b);
    }
  }
  const idat = deflateSync(Buffer.from(raw));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// rounded-corner indigo tile with a white "M"-ish glyph
function makePixel(size, maskable) {
  const radius = maskable ? size * 0.5 : size * 0.22;
  return (x, y) => {
    const cx = x - size / 2;
    const cy = y - size / 2;
    const insideRounded =
      Math.abs(cx) <= size / 2 - radius || Math.abs(cy) <= size / 2 - radius
        ? true
        : Math.hypot(Math.max(Math.abs(cx) - (size / 2 - radius), 0), Math.max(Math.abs(cy) - (size / 2 - radius), 0)) <= radius;
    if (!insideRounded) return [246, 248, 251]; // page bg outside tile
    // gradient
    const t = (x + y) / (2 * size);
    const r = Math.round(99 + (139 - 99) * t);
    const g = Math.round(102 + (92 - 102) * t);
    const b = Math.round(241 + (246 - 241) * t);
    // glyph: simple white parallelogram "M"
    const inGlyph =
      y > size * 0.3 &&
      y < size * 0.7 &&
      ((Math.abs(x - size * 0.32) < size * 0.045 && y < size * 0.62) ||
        (Math.abs(x - size * 0.68) < size * 0.045 && y < size * 0.62) ||
        (Math.abs(x - size * 0.5) < size * 0.05 && y >= size * 0.34 && y <= size * 0.48) ||
        (Math.abs(x - size * 0.5 - (y - size * 0.34) * 0.55) < size * 0.035 && y < size * 0.48) ||
        (Math.abs(x - size * 0.5 + (y - size * 0.34) * 0.55) < size * 0.035 && y < size * 0.48));
    return inGlyph ? [255, 255, 255] : [r, g, b];
  };
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'icon-192.png'), png(192, 192, makePixel(192, false)));
writeFileSync(join(outDir, 'icon-512.png'), png(512, 512, makePixel(512, false)));
writeFileSync(join(outDir, 'icon-maskable-512.png'), png(512, 512, makePixel(512, true)));
console.log('PWA icons written to static/');
