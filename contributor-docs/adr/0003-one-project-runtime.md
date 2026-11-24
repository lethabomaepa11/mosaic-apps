# ADR 0003: One deployable application runtime

Status: accepted

Generated apps deploy one SvelteKit project. A minimal `/api/[...path]` adapter
forwards requests to Hono and a catch-all loader resolves published database pages.
This removes the separate API deployment, CORS, and public API URL while preserving
Hono as the server implementation. PostgreSQL remains an external durable service;
Studio is an optional local or hosted authoring client.
