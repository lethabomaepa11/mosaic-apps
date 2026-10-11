---
sidebar_position: 14
---

# Road to v1

These are planned capabilities, not features available today. The goal for v1
is to make complete business workflows easy to create, extend, and operate.

## Generate a complete record workflow

Choose an entity and generate a searchable table, create/edit form, and detail
page together. Configure columns, filters, relationships, permissions, row
actions, and drill-down destinations from one workflow setup.

## Reliable authoring and runtime state

Recover unsaved drafts after a reload, resolve concurrent edits without losing
work, and restore an earlier published definition. Give data loading a consistent
loading/error/retry lifecycle, cancel stale requests, and add opt-in state
persistence. Validate embedded forms as part of their parent submission.

## Business workflows and integrations

Add reusable approval transitions, confirmations, conditional actions, and
record-aware table actions. Run durable jobs and external integrations on the
server with retries, idempotency, and audit history. Keep secrets on the server.

## Enterprise access and governance

Support SSO, enforced page and record permissions, and tenant isolation where
required. Review and promote definitions across development, staging, and
production, with versioned metadata and reproducible rollback.

## Consistent design and operations

Provide accessible component defaults, named light/dark themes, uploaded brand
assets, responsive layouts, and a polished application shell. Require evidence
for supported deployment paths, health monitoring, migration review, backup
restoration, and rollback before declaring v1 production ready.

## Current boundaries

Runtime state scopes, declarative actions, sandboxed scripts, inline previews,
and save-and-publish are implemented. Draft conflict resolution, durable workflow
execution, SSO, tenant isolation, and state persistence still require work.
Form data-source settings can be stored, but automatic loading for every source
type is not yet complete. Page access settings need complete runtime enforcement.

Start with [Quickstart](./quickstart.md) and use the
[Deployment guide](./deployment.md) for the hosting setup currently supported.
