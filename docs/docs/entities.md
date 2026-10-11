---
sidebar_position: 5
---

# Entities

An entity is one JSON file (`name.entity.json`) describing a domain object.
Mosaic turns it into a table, a CRUD API, validation, pickers and forms.

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
    { "name": "email", "label": "Email", "type": "string", "format": "email", "unique": true },
    { "name": "status", "label": "Status", "type": "enum", "default": "prospect",
      "options": [{ "value": "prospect", "label": "Prospect" }, { "value": "active", "label": "Active" }] },
    { "name": "owner", "label": "Owner", "type": "ref", "refEntity": "employee" }
  ]
}
```

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
`softDelete: true`) are managed automatically.

## Permissions

`read/create/update/delete` accept role names; `["*"]` means public.
Entity-level role gates beat broad `entity:*` grants; exact
`entity:<name>:*` grants override gates; `admin` bypasses all. See
[Security](./security.md).
