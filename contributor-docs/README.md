# Contributor documentation

Public documentation lives in `docs/docs`; keep it focused on application usage.
The v1 product roadmap is in `docs/docs/roadmap.md`. Release engineering and
implementation decisions belong in this directory.

## Refresh screenshots

Start the seeded local stack with `npm run dev`, then run `npm run docs:screenshots`.
The capture script creates fictional form/page fixtures, verifies Monaco
Apply/Cancel and JSON validation, writes images to `docs/static/img/screenshots`,
and removes its fixtures. Use only the local demonstration database. Windows
uses installed Edge; on other platforms run `npx playwright install chromium`
or set `MOSAIC_BROWSER_EXECUTABLE_PATH` to your browser executable.

Build public docs with `npm run docs:build`; `npm run docs:start` serves them on 3003.

The public site in `docs/` teaches application builders how to use Mosaic.
Repository development and release procedures belong here.

- [Enterprise architecture and delivery priorities](./enterprise-architecture.md)
- [Package validation and releasing](./releasing.md)
- [Current execution plan](../.opencode/plan.md)
- [Handoff and implementation history](../HANDOFF.md)

## Develop locally

```bash
npm install
npm run build
npm run dev
```

Repository Studio uses `http://localhost:3000` and the API uses
`http://localhost:3001`. Generated applications use web `3000`, API `3001`, and
Studio `3002` so all three services can run together. Override ports through the
CLI or the documented environment variables when running multiple projects.

Keep Studio source changes synchronized with the Studio template. Update the
public usage guide and capture real interface screenshots when behavior changes.
Use small commits with a single clear purpose and include validation evidence.
