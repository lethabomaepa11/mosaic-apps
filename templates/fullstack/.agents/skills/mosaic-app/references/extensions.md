# Custom code and packages

Use built-in components and actions when they fit. Otherwise add the smallest
ordinary Svelte component, action, or Hono endpoint and register it through Mosaic's
public extension contract.

- Keep the component usable outside the builder; registration supplies Studio
  metadata, inspector fields, bindings, events, and defaults.
- Register package components with `registerComponent` from `@mosaic-apps/ui` in
  `apps/web/src/lib/mosaic-components.ts`. Studio runs inside the same app at
  `/studio`, so this one registration feeds both the palette and published pages.
  Use a stable namespaced lowercase type such as `acme.metric-card`.
- Use Svelte for the default runtime. A framework-neutral Web Component is the
  interoperability boundary when a non-Svelte library must render UI.
- Keep secrets and privileged SDK calls server-side.
- Add explicit server handlers to `apps/web/src/lib/server/endpoints.ts`; their
  declared paths mount under `/api/extensions`. They require authentication by
  default. Use `permission` for RBAC and `public: true` only after reviewing public
  input validation, signature checks, and rate limits.
- Reuse installed packages and platform APIs. When a new package is necessary,
  update both `package.json` and the lockfile and explain its runtime location.
- Do not install arbitrary packages into a hosted Studio process; generation and
  builds belong in an isolated workspace.
- Studio is part of the app: routes in `apps/web/src/routes/studio`, code in
  `apps/web/src/lib/studio`. Public routes live in the `(app)` route group, so
  `/studio` keeps its own layout. Do not add public routes under `/studio`.
- A concrete SvelteKit route may override the database catch-all route. Keep shared
  Mosaic route and API logic in framework packages, not copied generated files.

Run typechecking and a production build after adding a package or registration.
