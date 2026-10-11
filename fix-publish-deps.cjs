const fs = require('fs');

const packages = {
  'packages/server/package.json': {
    '@mosaic-apps/core': '0.1.0'
  },
  'packages/ui/package.json': {
    '@mosaic-apps/core': '0.1.0'
  },
  'packages/cli/package.json': {
    '@mosaic-apps/core': '0.1.0',
    '@mosaic-apps/server': '0.1.0'
  },
  'apps/studio/package.json': {
    '@mosaic-apps/core': '0.1.0',
    '@mosaic-apps/ui': '0.1.0'
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