---
audience: contributors
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
then `@mosaic-apps/cli`. The packages currently share version `0.2.0`; bump and
review versions and changelogs together before the first release.

## Publishing manually

Run `npm run release:publish` after validation. It publishes in dependency order,
skips versions already present in the registry, and stops on registry/authentication
errors. CI uses the same command. Published versions are immutable: bump versions
for subsequent source changes instead of expecting a repeated push to overwrite them.

```bash
# Login to npm (requires 2FA or automation token)
npm login

# Build and publish the four public packages in dependency order
npm run build
npm run release:check
npm publish --workspace @mosaic-apps/core --access public
npm publish --workspace @mosaic-apps/server --access public
npm publish --workspace @mosaic-apps/ui --access public
npm publish --workspace @mosaic-apps/cli --access public
```

## Automated publishing (CI/CD)

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push to `main`:

1. **Build & Test** - Installs deps, typechecks, builds, runs tests
2. **Publish** - If build passes, publishes to npm using `NPM_TOKEN` secret

### Setup

The current workflow uses the `NPM_TOKEN` GitHub secret. Configure a scoped
granular token with publish permissions and the authentication settings required
by the npm account. npm recommends OIDC trusted publishing for supported CI
providers; configuring it also requires registering each package's trusted
publisher and updating the workflow. See [npm CI authentication](https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow/)
and [trusted publishing](https://docs.npmjs.com/trusted-publishers/).

The workflow publishes only the four public packages; Studio is private. It
currently runs publishing on a successful push to `main`. Versions must be new
before that run; npm does not permit overwriting a published version.

### Versioning

All packages share the same version. To release:

```bash
# Update the versions in packages/{core,server,ui,cli}/package.json,
# internal dependency ranges, Studio and template dependencies together.
# Then refresh the lockfile and verify.
npm install --package-lock-only
npm run typecheck
npm run release:check

# Commit and push
git push origin main --tags

# CI will build, test, and publish
```

## Validate the artifacts as a consumer

Create tarballs in a named output directory, then run:

```bash
npm run release:consumer -- /absolute/path/to/tarballs
```

The script installs the four tarballs outside the repository, invokes the packed
CLI and its bundled template, and builds the generated API, web app, and Studio.
It also builds the web app for Netlify. It prints the retained temporary
directory for inspection. This verifies package consumption without local source
links and without publishing.

## Package details

- `@mosaic-apps/ui` - Source-first Svelte package. Consumers need Svelte 5, Tailwind CSS 4, and the Tailwind Vite plugin. Import `@mosaic-apps/ui/style.css` or the package entry from a Svelte-aware bundler.
- `@mosaic-apps/core`, `@mosaic-apps/server`, `@mosaic-apps/cli` - Publish compiled ESM and declaration files from `dist`.
- `@mosaic-apps/cli` - Includes the generated full-stack template in its tarball. The pack check confirms the template files are present. Review the generated template's dependency versions and test a scaffolded app before release.
