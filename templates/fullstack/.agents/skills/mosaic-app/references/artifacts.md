# Database-first artifacts

Pages and forms are JSON internally, but application users edit them through Studio
or Mosaic APIs. The database is authoritative.

- Work against stable IDs or slugs; names are display labels.
- Keep routes normalized and unique. `/api/*` and Mosaic internal paths are reserved.
- Use expected versions when saving to prevent stale-tab overwrites.
- Autosave may update a draft; explicit save/publish creates immutable history.
- Restore by creating a new forward revision from old content, never by deleting or
  rewriting revision rows.
- Public runtime reads only published revisions. Draft preview requires an
  authenticated or signed preview context.
- Prefer semantic component-tree changes over string editing serialized JSON.

Custom Svelte can embed database artifacts by stable name/slug through the public
`MosaicPage` and `MosaicForm` runtime APIs when available. Do not copy an artifact
into a Svelte file merely to customize its surrounding layout.
