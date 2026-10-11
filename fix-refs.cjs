const fs = require('fs');
const files = [
  'apps/studio/package.json',
  'apps/studio/package-lock.json'
];
files.forEach(f => {
  try {
    let c = fs.readFileSync(f, 'utf8');
    c = c.replace(/"@mosaic\//g, '"@mosaic-apps/mosaic-');
    fs.writeFileSync(f, c);
    console.log('Updated:', f);
  } catch (e) {
    console.log('Skipped:', f, e.message);
  }
});