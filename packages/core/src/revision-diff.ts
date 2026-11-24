import type { ArtifactChange } from './types/platform.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => equal(item, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
    return keys.every((key) => key in left && key in right && equal(left[key], right[key]));
  }
  return false;
}

/** Produce a deterministic structural diff suitable for history UIs and CLI output. */
export function diffArtifactSnapshots(before: unknown, after: unknown, path = ''): ArtifactChange[] {
  if (equal(before, after)) return [];

  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return keys.flatMap((key) => {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in before)) return [{ path: childPath, kind: 'added' as const, after: after[key] }];
      if (!(key in after)) return [{ path: childPath, kind: 'removed' as const, before: before[key] }];
      return diffArtifactSnapshots(before[key], after[key], childPath);
    });
  }

  return [{ path: path || '$', kind: 'changed', before, after }];
}
