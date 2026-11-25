---
title: Security and access
---

# Security and access

## Authentication

Sign in at `/login` or call `POST /api/auth/login`. The API sets an HttpOnly `mosaic_session` cookie for same-origin browser sessions and returns a JWT for API clients. The Svelte client can store the bearer token under `mosaic_token` in local storage. Passwords are hashed with scrypt.

Use a stable, private `MOSAIC_JWT_SECRET` per environment. Changing it invalidates existing sessions. Disable public sign-up for internal applications. Where self-service registration is enabled, new accounts get the viewer role after the initial administrator has been provisioned. [App integrations](./app-integrations.md#oauth-sign-in)

## Roles and permissions

| Seeded role | Typical access |
| --- | --- |
| `admin` | Full access |
| `editor` | Read, create, and update records by default, plus page and form management |
| `viewer` | Read records by default |

Entity definitions can tighten those defaults per operation. `["*"]` means any signed-in user when authentication is enabled. Entity role gates take precedence over broad grants such as `entity:*:read`. An exact entity-scoped grant or administrator access can override a gate. Missing credentials usually return 401, while an authenticated denial returns 403.

Page visibility and data authorization serve different purposes. Use page access settings for the route and sidebar, and enforce access again in the underlying API. Role-aware page API enforcement requires a framework build that supports page roles. Cloud-generated frontends also check page roles when rendering. A sidebar link, hidden field, or query filter provides no record-level isolation.

## Protect production data

Use TLS and keep database, signing, and provider credentials in server-side settings. Keep secrets out of entity fields because audit records can contain changed values. Back up both the database and persistent file storage.

For record ownership or tenant isolation, enforce a trusted tenant or actor scope on the server for every read and write. For sensitive actions, validate the body, derive identity from the session, and perform related updates in a database transaction. [Server extensions](./extensions.md#server-extensions)
