# ADR 0002: Structured immutable history

Status: accepted

Every published page, form, or database-owned entity definition creates an
immutable revision with a parent, canonical checksum, author, origin, message, and
snapshot. Restoring creates a new forward revision. Expected-version checks reject
stale writes. Entity restoration remains migration-reviewed because its snapshot
can imply destructive physical-schema changes.
