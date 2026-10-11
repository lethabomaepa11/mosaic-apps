import 'reflect-metadata';

const ENTITY_KEY = 'mosaic:entity';
const FIELDS_KEY = 'mosaic:fields';

function Entity(options) {
  return (target, context) => {
    const mode = context && typeof context === 'object' ? 'standard' : 'legacy';
    const md = context && context.metadata;
    Reflect.defineMetadata(ENTITY_KEY, { options, mode, md }, target);
    if (md) console.log('  entity sees md.fields =', JSON.stringify(md[FIELDS_KEY]));
  };
}
function Field(options) {
  return (target, context) => {
    if (typeof context === 'string' || typeof context === 'symbol') {
      // legacy
      const list = Reflect.getMetadata(FIELDS_KEY, target) ?? [];
      list.push({ name: String(context), ...options });
      Reflect.defineMetadata(FIELDS_KEY, list, target);
      console.log('  legacy field on proto, count', list.length);
      return;
    }
    const md = context.metadata;
    if (!md) throw new Error('no metadata - set experimentalDecorators or polyfill');
    const own = Object.prototype.hasOwnProperty.call(md, FIELDS_KEY) ? md[FIELDS_KEY] : [...(md[FIELDS_KEY] ?? [])];
    own.push({ name: String(context.name), ...options });
    md[FIELDS_KEY] = own;
    console.log('  standard field, count', own.length, 'same md object?', true);
  };
}

@Entity({ name: 'base' })
class Base {
  @Field({ type: 'string' })
  baseName;
}

@Entity({ name: 'child' })
class Child extends Base {
  @Field({ type: 'int' })
  age;
}

const meta = Reflect.getMetadata(ENTITY_KEY, Child);
console.log('mode:', meta.mode, 'md is object:', !!meta.md);
console.log('child md fields:', JSON.stringify(meta.md && meta.md[FIELDS_KEY]));
console.log('child proto fields:', JSON.stringify(Reflect.getMetadata(FIELDS_KEY, Child.prototype)));
console.log('base proto fields:', JSON.stringify(Reflect.getMetadata(FIELDS_KEY, Base.prototype)));
console.log('child[Symbol.metadata]:', Child[Symbol.metadata]);
