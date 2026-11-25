import { Hono } from 'hono';
import { z } from 'zod';
import { type AuthEnv } from './auth.js';
import { writeAudit } from './audit.js';
import { fail, ok, readJson } from './http.js';
import { requirePermission } from './rbac.js';
import type { Db } from '../db/driver.js';

export type NotificationOptions =
  | { provider: 'ntfy'; server: string; topic: string; token?: string }
  | { provider: 'resend'; from: string; apiKey: string };

const notification = z.object({
  to: z.email().max(254).optional(),
  title: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(3000),
});

export function notificationOptions(env: NodeJS.ProcessEnv): NotificationOptions | undefined {
  if (env.MOSAIC_NOTIFICATION_PROVIDER === 'ntfy' && env.MOSAIC_NTFY_TOPIC) {
    return { provider: 'ntfy', server: env.MOSAIC_NTFY_URL || 'https://ntfy.sh', topic: env.MOSAIC_NTFY_TOPIC, token: env.MOSAIC_NTFY_TOKEN };
  }
  if (env.MOSAIC_NOTIFICATION_PROVIDER === 'resend' && env.MOSAIC_RESEND_API_KEY && env.MOSAIC_RESEND_FROM) {
    return { provider: 'resend', from: env.MOSAIC_RESEND_FROM, apiKey: env.MOSAIC_RESEND_API_KEY };
  }
}

export function notificationRoutes(db: Db, options?: NotificationOptions) {
  const app = new Hono<AuthEnv>();
  let target = 'https://api.resend.com/emails';
  if (options?.provider === 'ntfy') {
    const server = new URL(options.server);
    if (server.username || server.password || server.search || server.hash || !(
      server.protocol === 'https:' || server.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(server.hostname)
    ) || !/^[a-zA-Z0-9_-]{1,64}$/.test(options.topic)) throw new Error('Invalid ntfy server or topic.');
    target = server.href;
  }
  app.get('/', (c) => {
    if (!requirePermission(c.get('user'), 'notifications:send')) return fail(c, 403, 'Missing permission: notifications:send', 'FORBIDDEN');
    return ok(c, { provider: options?.provider ?? null });
  });
  app.post('/', async (c) => {
    const user = c.get('user');
    if (!requirePermission(user, 'notifications:send')) return fail(c, 403, 'Missing permission: notifications:send', 'FORBIDDEN');
    if (!options) return fail(c, 503, 'Configure a notification provider for this app', 'NOTIFICATIONS_UNAVAILABLE');
    if (c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return fail(c, 400, 'Notifications require an application/json request', 'BAD_NOTIFICATION');
    }
    const parsed = notification.safeParse(await readJson(c));
    if (!parsed.success) return fail(c, 422, 'Provide a valid title, message, and optional email recipient', 'BAD_NOTIFICATION');
    const { title, message, to } = parsed.data;
    if (options.provider === 'resend' && !to) return fail(c, 422, 'An email recipient is required', 'BAD_NOTIFICATION');
    const key = options.provider === 'ntfy' ? options.token : options.apiKey;
    try {
      const response = await fetch(target, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify(options.provider === 'ntfy'
          ? { topic: options.topic, title, message }
          : { from: options.from, to: [to], subject: title, text: message }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return fail(c, 502, 'The notification provider rejected the message', 'NOTIFICATION_FAILED');
      }
      await response.body?.cancel();
    } catch {
      return fail(c, 502, 'Could not reach the notification provider', 'NOTIFICATION_FAILED');
    }
    writeAudit(db, { action: 'notification.send', entity: 'notification', user, changes: { provider: { from: null, to: options.provider } } });
    return ok(c, { sent: true, provider: options.provider }, 202);
  });
  return app;
}
