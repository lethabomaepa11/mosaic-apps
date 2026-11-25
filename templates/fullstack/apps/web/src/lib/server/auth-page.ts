import type { FormNode } from '@mosaic-apps/core';
import { mosaicServer } from './mosaic';

export async function authPageLayout(registering: boolean) {
  const { rows: [page] } = await (await mosaicServer()).db.query<{ schema: FormNode }>(
    'SELECT schema FROM mosaic_pages WHERE route = $1 AND published = true', [registering ? '/signup' : '/login'],
  );
  const fallback = registering ? 'Create an account' : 'Sign in';
  const labels = { name: 'Name', email: 'Email', password: 'Password' };
  const required = (registering ? ['name', 'email', 'password'] : ['email', 'password']) as Array<keyof typeof labels>;
  const order: Array<keyof typeof labels> = [];
  const copy: string[] = [];
  let title = fallback, submitLabel = fallback;
  let alternateLabel = registering ? 'Already have an account? Sign in' : 'Create an account';
  function readComponent(node: FormNode | null, depth = 0) {
    if (!node || depth > 20) return;
    const { type, props, id } = node;
    const { text, binding, label } = props ?? {};
    if (type === 'heading' && typeof text === 'string' && text.trim()) title = text;
    if (type === 'text' && typeof text === 'string') {
      if (typeof id === 'string' && id.endsWith('_switch')) alternateLabel = text;
      else copy.push(text);
    }
    if (type === 'button' && typeof label === 'string' && label.trim()) submitLabel = label;
    if (type === 'textField' && required.includes(binding as keyof typeof labels)) {
      const field = binding as keyof typeof labels;
      if (!order.includes(field)) order.push(field);
      if (typeof label === 'string' && label.trim()) labels[field] = label;
    }
    if (Array.isArray(node.children)) for (const child of node.children) readComponent(child, depth + 1);
  }
  if (page) readComponent(page.schema);
  for (const field of required) if (!order.includes(field)) order.push(field);
  return { title, submitLabel, alternateLabel, copy, fields: order.map((name) => ({ name, label: labels[name] })) };
}
