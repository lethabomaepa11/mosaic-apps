const fs = require('fs');
const path = require('path');

const packages = {
  'packages/mosaic-core/package.json': {},
  'packages/mosaic-server/package.json': {
    '@mosaic-apps/mosaic-core': 'file:../mosaic-core'
  },
  'packages/mosaic-ui/package.json': {
    '@mosaic-apps/mosaic-core': 'file:../mosaic-core'
  },
  'packages/mosaic-cli/package.json': {
    '@mosaic-apps/mosaic-core': 'file:../mosaic-core',
    '@mosaic-apps/mosaic-server': 'file:../mosaic-server'
  },
  'apps/studio/package.json': {
    '@mosaic-apps/mosaic-core': 'file:../../packages/mosaic-core',
    '@mosaic-apps/mosaic-ui': 'file:../../packages/mosaic-ui'
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