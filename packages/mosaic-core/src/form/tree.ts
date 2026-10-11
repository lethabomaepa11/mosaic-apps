/** Pure operations on the form/page component tree. */

import { newId } from '../ids.js';
import type { FormNode } from '../types/form.js';

export type NodeVisitor = (node: FormNode, parent: FormNode | null, depth: number) => void | false;

/** Depth-first walk. Return `false` from visitor to skip a subtree. */
export function walk(root: FormNode, visit: NodeVisitor, parent: FormNode | null = null, depth = 0): void {
  const result = visit(root, parent, depth);
  if (result === false) return;
  for (const child of root.children ?? []) walk(child, visit, root, depth + 1);
}

export function findNode(root: FormNode, id: string): FormNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findParent(root: FormNode, id: string): FormNode | null {
  for (const child of root.children ?? []) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

/** Full path of node ids from root to target (inclusive). */
export function pathTo(root: FormNode, id: string, trail: string[] = []): string[] | null {
  const next = [...trail, root.id];
  if (root.id === id) return next;
  for (const child of root.children ?? []) {
    const found = pathTo(child, id, next);
    if (found) return found;
  }
  return null;
}

/** Containers can host children (renders dashed drop zone in the designer). */
export function canAcceptChildren(node: FormNode): boolean {
  return Array.isArray(node.children);
}

export function insertNode(root: FormNode, parentId: string, node: FormNode, index?: number): boolean {
  const parent = findNode(root, parentId);
  if (!parent || !Array.isArray(parent.children)) return false;
  const children = parent.children;
  const at = index === undefined ? children.length : Math.max(0, Math.min(index, children.length));
  children.splice(at, 0, node);
  return true;
}

export function removeNode(root: FormNode, id: string): FormNode | null {
  if (root.id === id) return null; // never remove the root
  const parent = findParent(root, id);
  if (!parent?.children) return null;
  const idx = parent.children.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const [removed] = parent.children.splice(idx, 1);
  return removed ?? null;
}

export function moveNode(root: FormNode, id: string, newParentId: string, index: number): boolean {
  if (id === root.id) return false;
  const node = findNode(root, id);
  if (!node) return false;
  // prevent moving a node into its own subtree
  if (findNode(node, newParentId)) return false;
  const newParent = findNode(root, newParentId);
  if (!newParent || !Array.isArray(newParent.children)) return false;
  const oldParent = findParent(root, id);
  if (!oldParent?.children) return false;
  const fromIdx = oldParent.children.findIndex((c) => c.id === id);
  if (fromIdx < 0) return false;
  const [moved] = oldParent.children.splice(fromIdx, 1);
  const at = Math.max(0, Math.min(index, newParent.children.length));
  newParent.children.splice(at, 0, moved!);
  return true;
}

export function updateNode(root: FormNode, id: string, patch: Partial<Pick<FormNode, 'props' | 'meta'>>): boolean {
  const node = findNode(root, id);
  if (!node) return false;
  if (patch.props) node.props = { ...node.props, ...patch.props };
  if (patch.meta) node.meta = { ...node.meta, ...patch.meta };
  return true;
}

export function setNodeProps(root: FormNode, id: string, props: Record<string, unknown>): boolean {
  const node = findNode(root, id);
  if (!node) return false;
  node.props = props;
  return true;
}

/** Deep clone with fresh node ids (used by duplicate). */
export function cloneTree(node: FormNode, keepIds = false): FormNode {
  return {
    id: keepIds ? node.id : newId('c'),
    type: node.type,
    props: node.props ? (JSON.parse(JSON.stringify(node.props)) as Record<string, unknown>) : undefined,
    children: Array.isArray(node.children) ? node.children.map((c) => cloneTree(c, keepIds)) : undefined,
    meta: node.meta ? { ...node.meta } : undefined,
  };
}

/** Clone subtree and insert right after the source node in the same parent. */
export function duplicateNode(root: FormNode, id: string): FormNode | null {
  if (id === root.id) return null;
  const parent = findParent(root, id);
  const node = findNode(root, id);
  if (!parent || !node || !parent.children) return null;
  const idx = parent.children.findIndex((c) => c.id === id);
  const copy = cloneTree(node);
  parent.children.splice(idx + 1, 0, copy);
  return copy;
}

export function flatten(root: FormNode): FormNode[] {
  const out: FormNode[] = [];
  walk(root, (n) => {
    out.push(n);
  });
  return out;
}

export function countNodes(root: FormNode): number {
  return flatten(root).length;
}

export function countByType(root: FormNode): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of flatten(root)) counts[node.type] = (counts[node.type] ?? 0) + 1;
  return counts;
}

/** Find a node by its `binding` prop (first match). */
export function findByBinding(root: FormNode, binding: string): FormNode | null {
  let found: FormNode | null = null;
  walk(root, (n) => {
    if (found) return false;
    if (n.props && n.props.binding === binding) found = n;
  });
  return found;
}

/** All binding paths declared in the tree (for the data panel). */
export function collectBindings(root: FormNode): string[] {
  const out: string[] = [];
  walk(root, (n) => {
    const b = n.props?.binding;
    if (typeof b === 'string' && b) out.push(b);
  });
  return [...new Set(out)];
}

/** Ensure every node has an id; repairs imported/hand-written JSON. */
export function assignMissingIds(root: FormNode): FormNode {
  if (!root.id) root.id = newId('c');
  root.children?.forEach(assignMissingIds);
  return root;
}

/** Normalise: root always exposes a children array so the canvas can drop into it. */
export function ensureRoot(root: FormNode): FormNode {
  if (!Array.isArray(root.children)) root.children = [];
  assignMissingIds(root);
  return root;
}
