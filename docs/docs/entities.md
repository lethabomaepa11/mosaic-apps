---
sidebar_position: 5
---

# Entities

An entity is a **TypeScript class** decorated with `@Entity` / `@Field` / `@Relation`
(a `*.entity.json` file works too). Mosaic turns it into a table, a CRUD API,
validation, pickers and forms.

```ts
import { Entity, Field, Relation } from '@mosaic/core';

@Entity({
  name: 'customer',
  label: 'Customer',
  labelPlural: 'Customers',
  icon: 'building',
  softDelete: true,
  list: { defaultSort: '-createdAt', labelField: 'name', columns: ['name', 'status'] },
  permissions: { read: ['*'], create: ['admin', 'sales'], update: ['admin', 'sales'], delete: ['admin'] },
})
export class Customer {
  @Field({ type: 'string', label: 'Name', required: true, searchable: true })
  name!: string;

  @Field({ type: 'string', label: 'Email', format: 'email', unique: true })
  email!: string;

  @Field({
    type: 'enum',
    label: 'Status',
    default: 'prospect',
    options: [{ value: 'prospect', label: 'Prospect' }, { value: 'active', label: 'Active' }],
  })
  status!: string;

  @Relation({ entity: () => Employee, required: true })
  owner!: string;
}
```

Classes live in `apps/api/src/entities/*.entity.ts`, are typechecked with your app,
and are synced into `mosaic_entities` at boot (a class wins over a JSON file with the
same `name`).

## @Entity options

Everything on `EntityDef` except `fields`: `name`, `label`, `labelPlural`,
`description`, `icon`, `softDelete`, `timestamps`, `audit`, `permissions`, `list`.
Omit `name` and it is derived from the class name — `OrderItem` → `order_item`.

## @Field options

The `FieldDef` options: `type`, `label`, `required`, `unique`, `indexed`,
`searchable`, `readonly`, `default`, `options` (enums), `length`/`maxLength`/
`minLength`, `precision`/`scale`, `min`/`max`, `format`, `refEntity`, `ui`.

Always pass `type` explicitly — decorators run without TypeScript's
`emitDecoratorMetadata`, so types are not inferred from the property.

## @Relation

```ts
@Relation({ entity: () => Employee, required: true, onDelete: 'cascade' })
owner?: string;
```

Accepts the target entity name or a thunk returning the class (resolved after all
modules load, so circular references are fine). Creates a `uuid` column + FK.

## Field types

| type | SQL | UI widget |
|---|---|---|
| `string` | `varchar(255)` (+`maxLength`) | Text field |
| `text` | `text` | Text area |
| `int` | `integer` | Number (step 1) |
| `decimal` | `numeric(16,2)` (or `precision/scale`) | Currency |
| `boolean` | `boolean` | Switch |
| `date` / `datetime` | `date` / `timestamptz` | Date / Date-time |
| `enum` | `text` + CHECK | Select |
| `ref` | `uuid` + FK | Record picker |
| `json` | `jsonb` | JSON editor |
| `file` | `text` (file id) | File upload |

Common flags: `required`, `unique`, `indexed`, `searchable` (ILIKE across
searchable columns via `?q=`), `readonly`, `min/max`, `minLength/maxLength`,
`pattern`, `default`. Relations: `refEntity` (+ optional `refLabelField`), with
`?include=<field>` expanding to `<field>_label` in responses and `onDelete:
cascade|set null|restrict`.

System columns (`id`, `createdAt`, `updatedAt`, `deletedAt` when
`softDelete: true`) are managed automatically — declaring them in a class is
optional and they are never part of `fields`.

## JSON entities

```json
{
  "name": "customer",
  "label": "Customer",
  "labelPlural": "Customers",
  "softDelete": true,
  "list": { "defaultSort": "-createdAt", "labelField": "name", "columns": ["name", "status"] },
  "permissions": { "read": ["*"], "create": ["admin", "sales"], "update": ["admin", "sales"], "delete": ["admin"] },
  "fields": [
    { "name": "name", "label": "Name", "type": "string", "required": true, "searchable": true },
    { "name": "status", "label": "Status", "type": "enum", "default": "prospect",
      "options": [{ "value": "prospect", "label": "Prospect" }, { "value": "active", "label": "Active" }] },
    { "name": "owner", "label": "Owner", "type": "ref", "refEntity": "employee" }
  ]
}
```

Both formats are read from the entities directory; a class always wins when both
declare the same entity name.

## Inheritance

Base classes contribute their fields, which keeps cross-cutting columns in one place:

```ts
export abstract class Base {
  @Field({ type: 'string', searchable: true })
  code!: string;
}

@Entity({ name: 'invoice' })
export class Invoice extends Base {
  @Field({ type: 'decimal', precision: 14, scale: 2, min: 0, default: 0 })
  total!: number;
}
```

## Permissions

`read/create/update/delete` accept role names; `["*"]` means public.
Entity-level role gates beat broad `entity:*` grants; exact
`entity:<name>:*` grants override gates; `admin` bypasses all. See
[Security](./security.md).
