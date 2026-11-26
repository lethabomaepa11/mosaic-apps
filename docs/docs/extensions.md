---
sidebar_position: 8
sidebar_label: Server extensions
---

# Extend an application

Both scaffolds support custom server handlers and custom Svelte artifact
components. In Next.js you can also extend the app shell and code-owned routes
with React.

## Register a component

A registration supplies the renderer, palette metadata, default properties, and
the inspector schema. Use a namespaced lowercase type so saved pages remain
portable:

```ts
import MetricCard from '@acme/mosaic-widgets/MetricCard.svelte';
import { registerComponent } from '@mosaic-apps/ui';

registerComponent({
  type: 'acme.metric-card',
  label: 'Metric card',
  category: 'Data',
  icon: 'barChart',
  component: MetricCard,
  pages: true,
  defaults: { label: 'Revenue', value: 0 },
  inspector: [
    { key: 'label', label: 'Label', kind: 'string' },
    { key: 'value', label: 'Value', kind: 'number' },
  ],
});
```

Add the registration to `apps/web/src/lib/mosaic-components.ts` in SvelteKit or
`runtime/components.js` in Next.js. Install the widget package, build the
application, and check
the Studio palette and published rendering. Saved artifacts store the component
type and props, so the runtime must have the same registration.

`registerComponent` rejects duplicate types unless `{ replace: true }` is explicit
and returns a cleanup function. Removing a package that still has saved nodes leaves
those nodes unsupported, so migrate or replace them before uninstalling it.

## Server extensions

Register handlers in the file below. Each registration mounts under `/api/extensions`.

| Framework | Registration module |
| --- | --- |
| SvelteKit | `apps/web/src/lib/server/endpoints.ts` |
| Next.js | `lib/endpoints.js` in a current scaffold, passed to `createMosaicServer({ endpoints })` |

This example registers a protected endpoint that returns the caller's email and
the submitted invoice ID. It illustrates the request and response contract.

```ts
import type { MosaicEndpointRegistration } from '@mosaic-apps/server';

export const endpoints: MosaicEndpointRegistration[] = [{
  method: 'POST', path: '/invoices/check', summary: 'Check invoice input',
  permission: 'entity:invoice:update',
  body: { type: 'object', required: ['invoiceId'], properties: { invoiceId: { type: 'string' } } },
  responses: { 200: { description: 'Validated input', schema: { type: 'object', properties: {
    invoiceId: { type: 'string' }, sentBy: { type: 'string' },
  } } }, 422: { description: 'Missing invoice ID' } },
  handler: async ({ json, user }) => {
    const input = await json<{ invoiceId?: unknown }>().catch(() => null);
    if (typeof input?.invoiceId !== 'string' || !input.invoiceId.trim()) {
      return Response.json({ error: 'Invoice ID is required' }, { status: 422 });
    }
    return { invoiceId: input.invoiceId, sentBy: user?.email };
  },
}];
```

Endpoints require authentication by default. Set `public: true` intentionally for
webhooks or public APIs, and verify their signatures or add rate limiting as needed.
Never import server modules into a Svelte component or browser bundle. Review
migrations and environment variables alongside dependency changes; visual artifact
publishing alone does not install code.

Declare each endpoint's input JSON Schema in `body` and its status-specific output
schema in `responses`. Validate the actual input inside your handler. On a server
build that includes the OpenAPI route, callers with `endpoints:read` can export
`GET /api/openapi` for Orval. The published server `0.4.1` predates this route.
Cloud releases with generated workflow endpoints already include `mosaic/openapi.json`.
For managed submissions, a supporting form renderer uses a relative path such as
`/extensions/leave-request/submit` in `settings.createEndpoint`.

Read the authenticated actor from the handler's `user` context and use `db.tx`
for changes that must succeed together. For a leave request, accept dates and a
reason as input, resolve the employee and organization from the signed-in
profile, and set the initial status in the same transaction. Approval, rejection
and balance updates belong in separate authenticated handlers.
