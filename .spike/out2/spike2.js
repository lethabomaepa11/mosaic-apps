var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
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
let Base = (() => {
    let _classDecorators = [Entity({ name: 'base' })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _baseName_decorators;
    let _baseName_initializers = [];
    let _baseName_extraInitializers = [];
    var Base = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _baseName_decorators = [Field({ type: 'string' })];
            __esDecorate(null, null, _baseName_decorators, { kind: "field", name: "baseName", static: false, private: false, access: { has: obj => "baseName" in obj, get: obj => obj.baseName, set: (obj, value) => { obj.baseName = value; } }, metadata: _metadata }, _baseName_initializers, _baseName_extraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            Base = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        baseName = __runInitializers(this, _baseName_initializers, void 0);
        constructor() {
            __runInitializers(this, _baseName_extraInitializers);
        }
    };
    return Base = _classThis;
})();
let Child = (() => {
    let _classDecorators = [Entity({ name: 'child' })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = Base;
    let _age_decorators;
    let _age_initializers = [];
    let _age_extraInitializers = [];
    var Child = class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _age_decorators = [Field({ type: 'int' })];
            __esDecorate(null, null, _age_decorators, { kind: "field", name: "age", static: false, private: false, access: { has: obj => "age" in obj, get: obj => obj.age, set: (obj, value) => { obj.age = value; } }, metadata: _metadata }, _age_initializers, _age_extraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            Child = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        age = __runInitializers(this, _age_initializers, void 0);
        constructor() {
            super(...arguments);
            __runInitializers(this, _age_extraInitializers);
        }
    };
    return Child = _classThis;
})();
const meta = Reflect.getMetadata(ENTITY_KEY, Child);
console.log('mode:', meta.mode, 'md is object:', !!meta.md);
console.log('child md fields:', JSON.stringify(meta.md && meta.md[FIELDS_KEY]));
console.log('child proto fields:', JSON.stringify(Reflect.getMetadata(FIELDS_KEY, Child.prototype)));
console.log('base proto fields:', JSON.stringify(Reflect.getMetadata(FIELDS_KEY, Base.prototype)));
console.log('child[Symbol.metadata]:', Child[Symbol.metadata]);
