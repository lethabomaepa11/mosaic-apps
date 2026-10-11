/** Demo entities used by seeds, the template and the studio's first-run experience. */

import type { EntityDef } from '../types/entity.js';

export const employeeEntity: EntityDef = {
  name: 'employee',
  label: 'Employee',
  labelPlural: 'Employees',
  icon: 'users',
  softDelete: false,
  list: { defaultSort: '-createdAt', labelField: 'fullName', columns: ['fullName', 'email', 'department', 'title', 'active'] },
  permissions: { read: ['*'], create: ['admin', 'hr'], update: ['admin', 'hr'], delete: ['admin'] },
  fields: [
    { name: 'fullName', label: 'Full name', type: 'string', required: true, searchable: true, minLength: 2, maxLength: 120 },
    { name: 'email', label: 'Email', type: 'string', format: 'email', required: true, unique: true, searchable: true },
    { name: 'title', label: 'Job title', type: 'string', searchable: true },
    { name: 'department', label: 'Department', type: 'enum', options: ['engineering', 'sales', 'operations', 'finance', 'hr'], default: 'operations' },
    { name: 'salary', label: 'Salary', type: 'decimal', precision: 12, scale: 2, min: 0 },
    { name: 'hiredOn', label: 'Hired on', type: 'date' },
    { name: 'active', label: 'Active', type: 'boolean', default: true },
  ],
};

export const customerEntity: EntityDef = {
  name: 'customer',
  label: 'Customer',
  labelPlural: 'Customers',
  icon: 'building',
  softDelete: true,
  list: { defaultSort: '-createdAt', labelField: 'name', columns: ['name', 'company', 'email', 'status', 'creditLimit'] },
  permissions: { read: ['*'], create: ['admin', 'sales'], update: ['admin', 'sales'], delete: ['admin'] },
  fields: [
    { name: 'name', label: 'Name', type: 'string', required: true, searchable: true, maxLength: 160 },
    { name: 'company', label: 'Company', type: 'string', searchable: true },
    { name: 'email', label: 'Email', type: 'string', format: 'email', unique: true, searchable: true },
    { name: 'phone', label: 'Phone', type: 'string', format: 'phone' },
    {
      name: 'status', label: 'Status', type: 'enum', required: true, default: 'prospect',
      options: [
        { value: 'prospect', label: 'Prospect', color: '#8b5cf6' },
        { value: 'active', label: 'Active', color: '#10b981' },
        { value: 'churned', label: 'Churned', color: '#f43f5e' },
      ],
    },
    { name: 'creditLimit', label: 'Credit limit', type: 'decimal', precision: 14, scale: 2, min: 0, default: 0 },
    { name: 'owner', label: 'Account owner', type: 'ref', refEntity: 'employee', onDelete: 'set null', ui: { widget: 'refSelect' } },
    { name: 'notes', label: 'Notes', type: 'text' },
  ],
};

export const productEntity: EntityDef = {
  name: 'product',
  label: 'Product',
  labelPlural: 'Products',
  icon: 'package',
  list: { defaultSort: 'name', labelField: 'name', columns: ['sku', 'name', 'category', 'price', 'stock', 'active'] },
  permissions: { read: ['*'], create: ['admin', 'sales'], update: ['admin', 'sales'], delete: ['admin'] },
  fields: [
    { name: 'sku', label: 'SKU', type: 'string', required: true, unique: true, searchable: true, format: 'slug' },
    { name: 'name', label: 'Name', type: 'string', required: true, searchable: true },
    { name: 'category', label: 'Category', type: 'enum', options: ['hardware', 'software', 'services', 'accessories'], default: 'hardware' },
    { name: 'price', label: 'Price', type: 'decimal', required: true, precision: 12, scale: 2, min: 0, format: 'money' },
    { name: 'cost', label: 'Cost', type: 'decimal', precision: 12, scale: 2, min: 0, format: 'money' },
    { name: 'stock', label: 'Stock', type: 'int', default: 0, min: 0 },
    { name: 'active', label: 'Active', type: 'boolean', default: true },
    { name: 'description', label: 'Description', type: 'text' },
  ],
};

export const orderEntity: EntityDef = {
  name: 'order',
  label: 'Order',
  labelPlural: 'Orders',
  icon: 'cart',
  softDelete: false,
  list: { defaultSort: '-orderDate', labelField: 'orderNumber', columns: ['orderNumber', 'customer', 'status', 'quantity', 'unitPrice', 'orderDate'] },
  permissions: { read: ['*'], create: ['admin', 'sales'], update: ['admin', 'sales'], delete: ['admin'] },
  fields: [
    { name: 'orderNumber', label: 'Order number', type: 'string', required: true, unique: true, searchable: true, default: 'ORD-1001' },
    { name: 'customer', label: 'Customer', type: 'ref', refEntity: 'customer', required: true, onDelete: 'restrict', ui: { widget: 'refSelect' } },
    { name: 'product', label: 'Product', type: 'ref', refEntity: 'product', required: true, onDelete: 'restrict', ui: { widget: 'refSelect' } },
    { name: 'quantity', label: 'Quantity', type: 'int', required: true, default: 1, min: 1, max: 100000 },
    { name: 'unitPrice', label: 'Unit price', type: 'decimal', precision: 12, scale: 2, min: 0, format: 'money' },
    { name: 'orderDate', label: 'Order date', type: 'date', required: true },
    {
      name: 'status', label: 'Status', type: 'enum', required: true, default: 'pending',
      options: [
        { value: 'pending', label: 'Pending', color: '#f59e0b' },
        { value: 'paid', label: 'Paid', color: '#10b981' },
        { value: 'shipped', label: 'Shipped', color: '#3b82f6' },
        { value: 'cancelled', label: 'Cancelled', color: '#f43f5e' },
      ],
    },
    { name: 'notes', label: 'Notes', type: 'text' },
  ],
};

export const demoEntities: EntityDef[] = [employeeEntity, customerEntity, productEntity, orderEntity];
