var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import 'reflect-metadata';
const ENTITY_KEY = 'mosaic:entity';
const FIELDS_KEY = 'mosaic:fields';
function Entity(options) {
    return (target, context) => {
        const mode = context && typeof context === 'object' ? 'standard' : 'legacy';
        const md = context && context.metadata;
        Reflect.defineMetadata(ENTITY_KEY, { options, mode, md }, target);
        if (md)
            console.log('  entity sees md.fields =', JSON.stringify(md[FIELDS_KEY]));
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
        if (!md)
            throw new Error('no metadata - set experimentalDecorators or polyfill');
        const own = Object.prototype.hasOwnProperty.call(md, FIELDS_KEY) ? md[FIELDS_KEY] : [...(md[FIELDS_KEY] ?? [])];
        own.push({ name: String(context.name), ...options });
        md[FIELDS_KEY] = own;
        console.log('  standard field, count', own.length, 'same md object?', true);
    };
}
let Base = class Base {
};
__decorate([
    Field({ type: 'string' })
], Base.prototype, "baseName", void 0);
Base = __decorate([
    Entity({ name: 'base' })
], Base);
let Child = class Child extends Base {
};
__decorate([
    Field({ type: 'int' })
], Child.prototype, "age", void 0);
Child = __decorate([
    Entity({ name: 'child' })
], Child);
const meta = Reflect.getMetadata(ENTITY_KEY, Child);
console.log('mode:', meta.mode, 'md is object:', !!meta.md);
console.log('child md fields:', JSON.stringify(meta.md && meta.md[FIELDS_KEY]));
console.log('child proto fields:', JSON.stringify(Reflect.getMetadata(FIELDS_KEY, Child.prototype)));
console.log('base proto fields:', JSON.stringify(Reflect.getMetadata(FIELDS_KEY, Base.prototype)));
console.log('child[Symbol.metadata]:', Child[Symbol.metadata]);
