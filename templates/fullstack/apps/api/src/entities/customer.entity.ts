import { Entity, Field, Relation } from '@mosaic-apps/core';
import { Employee } from './employee.entity.js';

/**
 * Customer — an entity written as a class instead of JSON.
 *
 * Edit this file, restart the API and run `npm run migrate`: Mosaic diffs the
 * registry against the database and applies the changes.
 */
@Entity({
  name: 'customer',
  label: 'Customer',
  labelPlural: 'Customers',
  icon: 'building',
  softDelete: true,
  list: {
    defaultSort: '-createdAt',
    labelField: 'name',
    columns: ['name', 'company', 'email', 'status', 'creditLimit'],
  },
  permissions: { read: ['*'], create: ['admin', 'sales'], update: ['admin', 'sales'], delete: ['admin'] },
})
export class Customer {
  @Field({ type: 'string', label: 'Name', required: true, searchable: true, maxLength: 160 })
  name!: string;

  @Field({ type: 'string', label: 'Company', searchable: true })
  company?: string;

  @Field({ type: 'string', label: 'Email', format: 'email', unique: true, searchable: true })
  email!: string;

  @Field({ type: 'string', label: 'Phone', format: 'phone' })
  phone?: string;

  @Field({
    type: 'enum',
    label: 'Status',
    required: true,
    default: 'prospect',
    options: [
      { value: 'prospect', label: 'Prospect', color: '#8b5cf6' },
      { value: 'active', label: 'Active', color: '#10b981' },
      { value: 'churned', label: 'Churned', color: '#f43f5e' },
    ],
  })
  status!: 'prospect' | 'active' | 'churned';

  @Field({ type: 'decimal', label: 'Credit limit', precision: 14, scale: 2, min: 0, default: 0 })
  creditLimit!: number;

  @Relation({ entity: () => Employee, label: 'Account owner', onDelete: 'set null', ui: { widget: 'refSelect' } })
  owner?: string;

  @Field({ type: 'text', label: 'Notes' })
  notes?: string;
}
