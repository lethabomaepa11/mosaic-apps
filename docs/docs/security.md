---
sidebar_position: 12
---

# Security

## Authentication

JWT bearer tokens (`Authorization: Bearer <token>`) and scrypt-hashed passwords.
`POST /api/auth/login|register|logout`, `GET /api/auth/me`, and
`POST /api/auth/change-password` provide the authentication surface. Same-origin
login also sets an HttpOnly `mosaic_session` cookie so protected database pages
can be enforced during server rendering. Bearer tokens remain supported for CLI
and SDK clients. The browser client also keeps the token in `localStorage`
(`mosaic_token`) for client-side API calls. Rotate `MOSAIC_JWT_SECRET` per
environment.

## RBAC model

Permissions are strings matched in this order:

1. `admin` role (or literal `*` permission) bypasses everything.
2. **Entity specificity rule**: entity-level role gates (`entity.permissions`)
   beat broad `entity:*` grants — except exact `entity:<name>:*` grants, which
   override the gates.
3. Otherwise, wildcard matching (`*`, `entity:customer:read`,
   `forms:manage`…) decides.

Denials are 403 `FORBIDDEN`. Public reads use `["*"]` on the entity.

Seeded roles: `admin` (`*`), `editor` (entities + forms + pages manage),
`viewer` (`entity:*:read`, `forms:read`, `pages:read`).

## Transport & storage

Run behind TLS in production; keep `.env` out of git (`.gitignore` covers
it). Uploads default to `./uploads` (serve via the files route or move to
object storage). Audit diffs exclude nothing — don't store secrets in entity
fields.

## Validation

Server-side zod schemas are built from the same field metadata the client
validates against, so required/format/unique rules can't be bypassed from the
browser. SQL is parameterised everywhere; identifiers are allow-listed
(`ident()`).
