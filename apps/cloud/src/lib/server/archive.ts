import { gzipSync } from 'node:zlib';

function octal(value: number, width: number): Buffer {
  return Buffer.from(value.toString(8).padStart(width - 1, '0') + '\0');
}

export function tarGzip(files: Array<{ path: string; content: string; mode?: string }>): Buffer {
  const chunks: Buffer[] = [];
  for (const file of files) {
    const data = Buffer.from(file.content, 'utf8');
    const header = Buffer.alloc(512);
    // ustar stores long paths as prefix (155 bytes) + "/" + name (100 bytes).
    let name = file.path, prefix = '';
    if (Buffer.byteLength(name) > 100) {
      const cut = name.lastIndexOf('/', name.length - 1);
      prefix = name.slice(0, cut); name = name.slice(cut + 1);
      if (cut < 0 || Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) throw new Error(`Path too long for tar: ${file.path}`);
    }
    header.write(name, 0, 'utf8');
    header.write(prefix, 345, 'utf8');
    octal(parseInt(file.mode ?? '100644', 8) & 0o777, 8).copy(header, 100);
    octal(0, 8).copy(header, 108); octal(0, 8).copy(header, 116);
    octal(data.length, 12).copy(header, 124); octal(Math.floor(Date.now() / 1000), 12).copy(header, 136);
    header.fill(0x20, 148, 156); header[156] = 0x30; header.write('ustar\0', 257, 'ascii'); header.write('00', 263, 'ascii');
    octal([...header].reduce((sum, byte) => sum + byte, 0), 8).copy(header, 148);
    chunks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks));
}
