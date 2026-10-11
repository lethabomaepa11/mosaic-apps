/** Toast notifications (module store, Svelte 5 runes). */

import { toast as sonnerToast } from 'svelte-sonner';

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
  const options = { description: text, duration: ttl };
  const sonnerId = variant === 'success'
    ? sonnerToast.success(title, options)
    : variant === 'warning'
      ? sonnerToast.warning(title, options)
      : variant === 'error'
        ? sonnerToast.error(title, options)
        : sonnerToast.info(title, options);
  const id = String(sonnerId ?? `t_${++seq}`);
  toasts = [...toasts, { id, variant, title, text, ttl }];
  if (ttl > 0) setTimeout(() => dismiss(id), ttl);
  return id;
}

function dismiss(id: string): void {
  sonnerToast.dismiss(id);
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
