---
sidebar_position: 5
---

# Publishing Mosaic packages

The workspace packages are configured for public npm scopes and the CLI's
`prepack` lifecycle bundles `templates/fullstack`. Check the complete package
set without publishing:

```bash
npm run release:check
```

The check builds typed packages, runs the UI Svelte check, and invokes
`npm pack --dry-run` for each package. The CLI template is copied only for the
pack lifecycle and the check cleans that copy afterward. The command does not upload tarballs. Publish the
packages in dependency order: `@mosaic/core`, `@mosaic/server`, `@mosaic/ui`,
then `@mosaic/cli`. The packages currently share version `0.1.0`; bump and
review versions and changelogs together before the first release.

`@mosaic/ui` is a source-first Svelte package. Consumer projects need Svelte 5,
Tailwind CSS 4 and the Tailwind Vite plugin; import `@mosaic/ui/style.css` or
the package entry from a Svelte-aware bundler. The other packages publish
compiled ESM and declaration files from `dist`.

`@mosaic/cli` includes the generated full-stack template in its tarball. The
pack check confirms the template files are present. Review the generated
template's dependency versions and test a scaffolded app before release.
