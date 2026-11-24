# ADR 0001: Database-first visual artifacts

Status: accepted

Pages, forms, navigation, themes, and visual settings are authored in PostgreSQL.
They are portable structured data, not source files users must edit. This enables
collaborative Studio editing and publishing without a code deployment. Custom
Svelte, dependencies, registrations, and code-owned entity definitions remain in
Git. Exports are recovery/review artifacts, not the live authoring source.
