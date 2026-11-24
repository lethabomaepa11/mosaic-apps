# Custom code and packages

Use built-in components and actions when they fit. Otherwise add the smallest
ordinary Svelte component, action, or Hono endpoint and register it through Mosaic's
public extension contract.

- Keep the component usable outside the builder; registration supplies Studio
  metadata, inspector fields, bindings, events, and defaults.
- Use Svelte for the default runtime. A framework-neutral Web Component is the
  interoperability boundary when a non-Svelte library must render UI.
- Keep secrets and privileged SDK calls server-side.
- Reuse installed packages and platform APIs. When a new package is necessary,
  update both `package.json` and the lockfile and explain its runtime location.
- Do not install arbitrary packages into a hosted Studio process; generation and
  builds belong in an isolated workspace.
- A concrete SvelteKit route may override the database catch-all route. Keep shared
  Mosaic route and API logic in framework packages, not copied generated files.

Run typechecking and a production build after adding a package or registration.
