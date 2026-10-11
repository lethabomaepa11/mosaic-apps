---
sidebar_position: 5
---

# Publishing Mosaic packages

The workspace packages are published under the `@mosaic-apps` npm scope. The CLI's
`prepack` lifecycle bundles `templates/fullstack`. Check the complete package
set without publishing:

```bash
npm run release:check
```

The check builds typed packages, runs the UI Svelte check, and invokes
`npm pack --dry-run` for each package. The CLI template is copied only for the
pack lifecycle and the check cleans that copy afterward. The command does not upload tarballs. Publish the
packages in dependency order: `@mosaic-apps/core`, `@mosaic-apps/server`, `@mosaic-apps/ui`,
then `@mosaic-apps/cli`. The packages currently share version `0.1.0`; bump and
review versions and changelogs together before the first release.

## Publishing manually

```bash
# Login to npm (requires 2FA or automation token)
npm login

# Or set token directly
npm config set //registry.npmjs.org/:_authToken <your-token>

# Build and publish all packages
npm run build
npm publish --workspaces --access public
```

## Automated publishing (CI/CD)

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push to `main`:

1. **Build & Test** - Installs deps, typechecks, builds, runs tests
2. **Publish** - If build passes, publishes to npm using `NPM_TOKEN` secret

### Setup

1. Create an npm automation token at https://www.npmjs.com/settings/tokens
   - Type: **Automation** (bypasses 2FA)
2. Add token as GitHub secret: `NPM_TOKEN`
3. Push to `main` → packages auto-publish on successful build

### Versioning

All packages share the same version. To release:

```bash
# Update version in all package.json files
npm version patch  # or minor/major

# Commit and push
git push origin main --tags

# CI will build, test, and publish
```

## Package details

- `@mosaic-apps/ui` - Source-first Svelte package. Consumers need Svelte 5, Tailwind CSS 4, and the Tailwind Vite plugin. Import `@mosaic-apps/ui/style.css` or the package entry from a Svelte-aware bundler.
- `@mosaic-apps/core`, `@mosaic-apps/server`, `@mosaic-apps/cli` - Publish compiled ESM and declaration files from `dist`.
- `@mosaic-apps/cli` - Includes the generated full-stack template in its tarball. The pack check confirms the template files are present. Review the generated template's dependency versions and test a scaffolded app before release.