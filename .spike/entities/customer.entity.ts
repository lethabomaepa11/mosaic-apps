import { Entity, Field, Relation } from '@mosaic/core';

export abstract class Base {
  @Field({ type: 'string', searchable: true })
  code!: string;
}

@Entity({
  name: 'customer',
  label: 'Customer',
  labelPlural: 'Customers',
  icon: 'building',
  softDelete: true,
  list: { defaultSort: '-createdAt', labelField: 'name', columns: ['name', 'status'] },
  permissions: { read: ['*'], create: ['admin'], update: ['admin'], delete: ['admin'] },
})
export class Customer extends Base {
  @Field({ type: 'id' })
  id!: string;

  @Field({ type: 'string', required: true, searchable: true, maxLength: 160 })
  name!: string;

  @Field({
    type: 'enum',
    required: true,
    default: 'prospect',
    options: [
      { value: 'prospect', label: 'Prospect', color: '#8b5cf6' },
      { value: 'active', label: 'Active', color: '#10b981' },
    ],
  })
  status!: 'prospect' | 'active';

  @Field({ type: 'decimal', min: 0, default: 0 })
  creditLimit!: number;

  @Relation({ entity: () => Employee, required: true })
  owner!: string;
}

@Entity({ name: 'employee' })
export class Employee {
  @Field({ type: 'string', required: true })
  name!: string;
}
