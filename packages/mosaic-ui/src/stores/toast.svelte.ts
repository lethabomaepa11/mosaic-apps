/** Toast notifications (module store, Svelte 5 runes). */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  text?: string;
  ttl: number;
}

let toasts = $state<Toast[]>([]);
let seq = 0;

function push(variant: ToastVariant, title: string, text?: string, ttl = 4000): string {
  const id = `t_${++seq}`;
  toasts = [...toasts, { id, variant, title, text, ttl }];
  if (ttl > 0) setTimeout(() => dismiss(id), ttl);
  return id;
}

function dismiss(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
}

export const toast = {
  get all(): Toast[] {
    return toasts;
  },
  info: (title: string, text?: string, ttl?: number) => push('info', title, text, ttl),
  success: (title: string, text?: string, ttl?: number) => push('success', title, text, ttl),
  warning: (title: string, text?: string, ttl?: number) => push('warning', title, text, ttl),
  error: (title: string, text?: string, ttl?: number) => push('error', title, text, ttl ?? 7000),
  dismiss,
};
