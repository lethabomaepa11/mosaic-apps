---
sidebar_position: 9
---

# History and releases

Mosaic keeps application definitions in PostgreSQL and gives them structured,
Git-like history. You do not need to edit or commit generated JSON files.

## Draft, save, and publish

- Studio may autosave a working draft without adding a history entry for every
  keystroke.
- **Save** validates the complete artifact, creates an immutable revision, and
  publishes that revision when the current workflow is save-and-publish.
- Runtime users only receive a published revision. Draft previews require an
  authenticated Studio session or signed preview.

Each revision records its parent, checksum, author, origin, message, timestamp, and
complete snapshot. Pages, forms, and database-edited entities use the same history
model. Code-owned entity files continue to use Git as well as Mosaic migration
history.

## View history

Open a page, form, or entity in Studio and choose **History**. The newest revision
appears first with its author/origin, message, time, and checksum prefix. A checksum
is a content identity, not a secret.

Select **Review changes** to compare a revision with the current artifact. Page and
form revisions can be restored from the same panel. The selected snapshot becomes a
new published revision; history is never rewritten.

Entity history is review-only in Studio because restoring a definition can require
a physical schema migration. Review the diff, make the forward entity change, then
inspect and apply the migration plan.

The history API is also available to authenticated tools:

```text
GET /api/pages/:id/revisions
GET /api/forms/:id/revisions
GET /api/entities/:name/revisions
GET /api/pages/:id/revisions/:revision/diff?against=current
POST /api/pages/:id/revisions/:revision/restore
```

## Conflicts and restoration

Saves include the revision that the editor loaded. If another author publishes
first, the stale save is rejected rather than overwriting their work. Studio can
then show both versions and let the author reconcile them.

Restoration is forward-only: Mosaic copies the selected old snapshot into a new
revision. Existing history is never rewritten or deleted. Entity restoration also
requires a reviewed forward migration when the physical schema changed.

## Releases and Git

An application release will group the exact published artifact revisions,
repository commit, and schema migration deployed to an environment. Use Git for
Svelte, TypeScript, dependencies, and other source files; use Mosaic history for
database-first visual artifacts. Exported releases provide review and recovery but
are not the live authoring source.
