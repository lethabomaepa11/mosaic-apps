---
title: Recipes
---

# Recipes

## Show a field conditionally

Set the field's `visibleIf` to an expression such as `data.status === "active" && data.total > 1000`. This changes the UI. Enforce any required business rule in the API as well. [Form JSON](./form-json.md#node-anatomy)

## Submit a request with server-managed fields

Define the dates and reason as form inputs. In the [server handler](./extensions.md#server-extensions), read the signed-in user, find their employee profile, and assign the organization and initial status during the database write. A Cloud release with a generated submission endpoint uses this pattern. [Mosaic Cloud](./cloud-studio.md)

## Add a review screen

Create a page at `/approvals` with a live table or a custom list endpoint. Use a dedicated authenticated endpoint for each decision. Check the caller's authority and the request's current state, then update the record and related balances in one transaction.

## Use shared reference values

Keep list values under **Settings → Reference lists**. Read them through `GET /api/ref-lists/:name` from a custom component.

## Scope records by organization

Enforce organization membership on the server using the authenticated actor. Apply that scope to reads, writes, and related record lookups. A browser-supplied filter can narrow an authorized result for display. [Security and access](./security.md)
