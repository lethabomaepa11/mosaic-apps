import { Entity, Field } from '@mosaic/core';

/** Employee — referenced by `Customer.owner`. */
@Entity({
  name: 'employee',
  label: 'Employee',
  labelPlural: 'Employees',
  icon: 'users',
  list: {
    defaultSort: '-createdAt',
    labelField: 'fullName',
    columns: ['fullName', 'email', 'department', 'title', 'active'],
  },
  permissions: { read: ['*'], create: ['admin', 'hr'], update: ['admin', 'hr'], delete: ['admin'] },
})
export class Employee {
  @Field({ type: 'string', label: 'Full name', required: true, searchable: true, minLength: 2, maxLength: 120 })
  fullName!: string;

  @Field({ type: 'string', label: 'Email', format: 'email', required: true, unique: true, searchable: true })
  email!: string;

  @Field({ type: 'string', label: 'Job title', searchable: true })
  title?: string;

  @Field({
    type: 'enum',
    label: 'Department',
    options: ['engineering', 'sales', 'operations', 'finance', 'hr'],
    default: 'operations',
  })
  department?: string;

  @Field({ type: 'decimal', label: 'Salary', precision: 12, scale: 2, min: 0 })
  salary?: number;

  @Field({ type: 'date', label: 'Hired on' })
  hiredOn?: Date;

  @Field({ type: 'boolean', label: 'Active', default: true })
  active?: boolean;
}
