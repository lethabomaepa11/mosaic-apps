---
sidebar_position: 8
---

# Extend with Svelte packages

Mosaic applications are ordinary SvelteKit workspaces. Add npm dependencies and
custom Svelte components when the built-in visual components are not enough.

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

Add that registration to both:

- `apps/web/src/lib/mosaic-components.ts` for the published application.
- `apps/studio/src/lib/mosaic-components.ts` for the visual palette, canvas, and inspector.

Install the widget package in both workspaces when it is not already hoisted by
the root workspace. Commit the package and lockfile changes, then run the web and
Studio checks before deployment. Saved artifacts contain only the stable component
type and props; they do not embed package source.

`registerComponent` rejects duplicate types unless `{ replace: true }` is explicit
and returns a cleanup function. Removing a package that still has saved nodes leaves
those nodes unsupported, so migrate or replace them before uninstalling it.

## Server extensions

Keep server-only packages under `apps/web/src/lib/server`. Entity classes and
`*.endpoint.ts` modules are discovered there. Explicit handlers belong in
`apps/web/src/lib/server/endpoints.ts` and mount under `/api/extensions`:

```ts
import type { MosaicEndpointRegistration } from '@mosaic-apps/server';

export const endpoints: MosaicEndpointRegistration[] = [{
  method: 'POST', path: '/invoices/send', summary: 'Send an invoice',
  permission: 'entity:invoice:update',
  responses: { 200: { description: 'Sent' } },
  handler: async ({ json, user }) => {
    const input = await json<{ invoiceId: string }>();
    return { invoiceId: input.invoiceId, sentBy: user?.email };
  },
}];
```

Endpoints require authentication by default. Set `public: true` intentionally for
webhooks or public APIs, and verify their signatures or add rate limiting as needed.
Never import server modules into a Svelte component or browser bundle. Review
migrations and environment variables alongside dependency changes; visual artifact
publishing alone does not install code.
