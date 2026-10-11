import { Entity, Field, Relation } from '@mosaic/core';

@Entity({
  name: 'customer',
  label: 'Customer',
  labelPlural: 'Customers',
  icon: 'building',
  softDelete: true,
  timestamps: true,
  audit: true,
})
export class Customer {
  @Field({ type: 'id' })
  id!: string;

  @Field({ type: 'string', required: true, searchable: true, maxLength: 160 })
  name!: string;

  @Field({ type: 'string', searchable: true })
  company?: string;

  @Field({ type: 'string', format: 'email', unique: true, searchable: true })
  email!: string;

  @Field({ type: 'string', format: 'phone' })
  phone?: string;

  @Field({ type: 'enum', required: true, default: 'prospect',
    options: [
      { value: 'prospect', label: 'Prospect', color: '#8b5cf6' },
      { value: 'active', label: 'Active', color: '#10b981' },
      { value: 'churned', label: 'Churned', color: '#f43f5e' },
    ]
  })
  status!: 'prospect' | 'active' | 'churned';

  @Field({ type: 'decimal', min: 0, default: 0 })
  creditLimit!: number;

  @Field({ type: 'text' })
  notes?: string;
}