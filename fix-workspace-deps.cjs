const fs = require('fs');
const path = require('path');

const packages = {
  'packages/core/package.json': {},
  'packages/server/package.json': {
    '@mosaic-apps/core': 'file:../mosaic-core'
  },
  'packages/ui/package.json': {
    '@mosaic-apps/core': 'file:../mosaic-core'
  },
  'packages/cli/package.json': {
    '@mosaic-apps/core': 'file:../mosaic-core',
    '@mosaic-apps/server': 'file:../mosaic-server'
  },
  'apps/studio/package.json': {
    '@mosaic-apps/core': 'file:../../packages/core',
    '@mosaic-apps/ui': 'file:../../packages/ui'
  }
};

Object.entries(packages).forEach(([path, deps]) => {
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (pkg.dependencies) {
    Object.entries(deps).forEach(([name, version]) => {
      if (pkg.dependencies[name]) {
        pkg.dependencies[name] = version;
      }
    });
  }
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  console.log('Updated:', path);
});