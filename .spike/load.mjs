import { loadEntityDefs, extractEntityDef, getEntityClass, registerEntity, loadEntitiesFromDir } from '@mosaic-apps/core';

const dir = new URL('./entities/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const classes = await loadEntitiesFromDir(dir);
for (const c of classes) registerEntity(c);
const defs = await loadEntityDefs(dir);
console.log(JSON.stringify(defs, null, 2));
