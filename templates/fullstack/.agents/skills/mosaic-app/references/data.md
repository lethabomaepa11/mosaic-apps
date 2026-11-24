# Entities and migrations

An entity definition produces a physical table plus metadata used by Mosaic.

- Inspect the current definition and migration plan before editing.
- Use supported Mosaic field and relation metadata; identifiers must satisfy the
  framework allow-list.
- Adding a nullable field or new table is normally safe. Drops, type narrowing,
  required fields without defaults, uniqueness, and relationship changes require
  data review.
- Never drop a physical entity table merely because its metadata is deleted.
- Keep business invariants in a transaction on the server, with authorization and
  audit behavior beside the mutation.
- Use pooled runtime connections for serverless hosting and a direct/admin
  connection for controlled migrations when the provider requires it.

For code-owned entities, update the source definition and use Mosaic migration
commands. For Studio-owned definitions, use the entity API so version history and
cache invalidation remain correct.
