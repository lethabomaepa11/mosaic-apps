function Entity(options) {
  return (target, context) => {
    console.log('ENTITY target:', typeof target, 'ctxKind:', context && context.kind, 'md:', typeof (context && context.metadata));
  };
}
function Field(options) {
  return (target, context) => {
    console.log('FIELD target:', typeof target, 'ctxType:', typeof context, 'kind:', context && context.kind, 'name:', context && String(context.name), 'md:', typeof (context && context.metadata));
    const md = context && context.metadata;
    if (md && typeof md === 'object') {
      md.fields = [...(md.fields ?? []), { name: String(context.name), ...options }];
    } else if (target && typeof target === 'object') {
      target.__fields = [...(target.__fields ?? []), { name: String(context), ...options }];
    }
  };
}
@Entity({ name: 'foo' })
export class Foo {
  @Field({ type: 'string' })
  name;
}
console.log('Symbol.metadata type:', typeof Symbol.metadata);
console.log('class [Symbol.metadata]:', Foo[Symbol.metadata]);
console.log('proto __fields:', Foo.prototype.__fields);
console.log('Reflect md:', typeof Reflect.getMetadata === 'function' ? 'reflect-loaded' : 'no-reflect');
