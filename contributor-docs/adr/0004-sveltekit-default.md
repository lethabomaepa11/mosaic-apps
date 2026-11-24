# ADR 0004: SvelteKit is the default renderer

Status: accepted

SvelteKit is the default because Mosaic business applications need shared state,
actions, SSR, auth-aware routing, and server endpoints in one component model.
Concrete Svelte routes override database routes and npm packages remain available.
Astro may become a content-focused output target, but multi-renderer islands are not
the default for deeply interactive generated applications.
