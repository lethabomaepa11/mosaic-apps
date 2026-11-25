---
title: History and releases
---

# History and releases

## Save and publish

SvelteKit Studio's **Save** publishes the current form or page in one database transaction. It records a revision with a snapshot, author, origin, checksum, and version. Preview shows the current editor draft. Save it before leaving the editor.

A save sends the version you loaded. When the API returns a 409 conflict, review the latest publication, reconcile your changes, and try again. [Visual Studio](./builder.md)

## View or restore history

Open an artifact in Studio and choose **History**. Use **Review changes** to compare revisions. Restoring a page or form copies the selected snapshot into a new revision. Entity history is for inspection. Make a forward entity change and review the migration when the database schema needs to change.

The API provides history routes for authorized callers.

```text
GET /api/pages/:id/revisions
GET /api/forms/:id/revisions
GET /api/entities/:name/revisions
GET /api/pages/:id/revisions/:revision/diff?against=current
POST /api/pages/:id/revisions/:revision/restore
```

Page history may require the page management permission on newer builds.

## Releases and Git

A Cloud release is a packaged source snapshot. Use Git for repository changes, Mosaic history for published definitions, and database backups for production data. To roll back safely, verify that the code, artifact revisions, and database schema work together. [Deployment checklist](./deployment.md#release-checklist)
