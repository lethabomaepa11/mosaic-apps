/** Demo forms, pages and reference lists used by `seed --demo`. */

import type { FormDef, PageDef } from '@mosaic-apps/core';
import type { Db } from './db/driver.js';

async function upsertForm(db: Db, form: FormDef): Promise<void> {
  const existing = await db.query('SELECT 1 FROM mosaic_forms WHERE slug = $1', [form.slug]);
  if (existing.rows.length) return;
  await db.query(
    `INSERT INTO mosaic_forms (id, slug, name, description, entity, version, published, schema, data_source, settings)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)`,
    [
      form.id,
      form.slug,
      form.name,
      form.description ?? null,
      form.entity ?? null,
      form.version,
      form.published,
      JSON.stringify(form.root),
      JSON.stringify(form.dataSource ?? { kind: 'none' }),
      JSON.stringify(form.settings ?? {}),
    ],
  );
}

async function upsertPage(db: Db, page: PageDef): Promise<void> {
  const existing = await db.query('SELECT 1 FROM mosaic_pages WHERE slug = $1', [page.slug]);
  if (existing.rows.length) return;
  await db.query(
    `INSERT INTO mosaic_pages (id, slug, route, name, description, version, published, schema, settings)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)`,
    [
      page.id,
      page.slug,
      page.route,
      page.name,
      page.description ?? null,
      page.version,
      page.published,
      JSON.stringify(page.root),
      JSON.stringify(page.settings ?? {}),
    ],
  );
}

export async function seedDemoArtifacts(db: Db): Promise<{ forms: number; pages: number }> {
  const customerForm: FormDef = {
    id: 'frm_customer01',
    slug: 'customer-form',
    name: 'Customer details',
    description: 'Create or edit a customer record',
    entity: 'customer',
    version: 1,
    published: true,
    dataSource: { kind: 'entity', entity: 'customer' },
    settings: { layout: 'vertical', columns: 2, submitLabel: 'Save customer', successMessage: 'Customer saved' },
    root: {
      id: 'frm_customer01_root',
      type: 'form',
      children: [
        {
          id: 'c_grid1',
          type: 'grid',
          props: { columns: 2, gap: 'md' },
          children: [
            { id: 'c_name', type: 'textField', props: { label: 'Name', binding: 'name', required: true, placeholder: 'Jane Cooper' } },
            { id: 'c_company', type: 'textField', props: { label: 'Company', binding: 'company', placeholder: 'Acme Inc.' } },
            { id: 'c_email', type: 'textField', props: { label: 'Email', binding: 'email', format: 'email', placeholder: 'jane@acme.com' } },
            { id: 'c_phone', type: 'textField', props: { label: 'Phone', binding: 'phone', placeholder: '+1 555 0100' } },
            {
              id: 'c_status',
              type: 'selectField',
              props: {
                label: 'Status',
                binding: 'status',
                options: [
                  { value: 'prospect', label: 'Prospect' },
                  { value: 'active', label: 'Active' },
                  { value: 'churned', label: 'Churned' },
                ],
                required: true,
              },
            },
            { id: 'c_credit', type: 'numberField', props: { label: 'Credit limit', binding: 'creditLimit', min: 0 } },
            { id: 'c_owner', type: 'refSelect', props: { label: 'Account owner', binding: 'owner', entity: 'employee' } },
          ],
        },
        { id: 'c_notes', type: 'textArea', props: { label: 'Notes', binding: 'notes', rows: 4 } },
      ],
    },
  };
  await upsertForm(db, customerForm);
  await upsertForm(db, buildOrderForm());
  await upsertPage(db, buildDashboardPage());

  const lists = [
    {
      name: 'ticket-priority',
      label: 'Ticket priority',
      items: [
        { value: 'low', label: 'Low', color: '#10b981' },
        { value: 'medium', label: 'Medium', color: '#f59e0b' },
        { value: 'high', label: 'High', color: '#ef4444' },
      ],
    },
    {
      name: 'yes-no',
      label: 'Yes / No',
      items: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
  ];
  for (const l of lists) {
    await db.query(
      'INSERT INTO mosaic_ref_lists (id, name, label, items) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (name) DO NOTHING',
      [`rl_${l.name}`, l.name, l.label, JSON.stringify(l.items)],
    );
  }
  return { forms: 2, pages: 1 };
}

function buildOrderForm(): FormDef {
  return {
    id: 'frm_order01',
    slug: 'order-form',
    name: 'New order',
    description: 'Capture a sales order',
    entity: 'order',
    version: 1,
    published: true,
    dataSource: { kind: 'entity', entity: 'order' },
    settings: { layout: 'vertical', columns: 2, submitLabel: 'Create order', successMessage: 'Order created' },
    root: {
      id: 'frm_order01_root',
      type: 'form',
      children: [
        {
          id: 'o_grid',
          type: 'grid',
          props: { columns: 2, gap: 'md' },
          children: [
            { id: 'o_number', type: 'textField', props: { label: 'Order number', binding: 'orderNumber', required: true } },
            { id: 'o_date', type: 'datePicker', props: { label: 'Order date', binding: 'orderDate', required: true } },
            { id: 'o_customer', type: 'refSelect', props: { label: 'Customer', binding: 'customer', entity: 'customer', required: true } },
            { id: 'o_product', type: 'refSelect', props: { label: 'Product', binding: 'product', entity: 'product', required: true } },
            { id: 'o_qty', type: 'numberField', props: { label: 'Quantity', binding: 'quantity', min: 1, required: true } },
            { id: 'o_price', type: 'currencyField', props: { label: 'Unit price', binding: 'unitPrice', min: 0 } },
            {
              id: 'o_status',
              type: 'selectField',
              props: {
                label: 'Status',
                binding: 'status',
                options: [
                  { value: 'pending', label: 'Pending' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'shipped', label: 'Shipped' },
                  { value: 'cancelled', label: 'Cancelled' },
                ],
                required: true,
              },
            },
            { id: 'o_notes', type: 'textArea', props: { label: 'Notes', binding: 'notes', rows: 3 } },
          ],
        },
      ],
    },
  };
}

function buildDashboardPage(): PageDef {
  return {
    id: 'pg_dashboard',
    slug: 'dashboard',
    route: '/dashboard',
    name: 'Dashboard',
    description: 'Demo dashboard with stats and live tables',
    version: 1,
    published: true,
    settings: { title: 'Dashboard', menu: { show: true, order: 1, icon: 'grid' } },
    root: {
      id: 'pg_dashboard_root',
      type: 'page',
      children: [
        { id: 'd_title', type: 'heading', props: { text: 'Sales dashboard', level: 1 } },
        {
          id: 'd_stats',
          type: 'statRow',
          props: {},
          children: [
            { id: 'd_s1', type: 'statCard', props: { label: 'Customers', entity: 'customer', trend: '+12%' } },
            { id: 'd_s2', type: 'statCard', props: { label: 'Orders', entity: 'order', trend: '+4%' } },
            { id: 'd_s3', type: 'statCard', props: { label: 'Products', entity: 'product' } },
          ],
        },
        {
          id: 'd_table',
          type: 'entityTable',
          props: {
            entity: 'order',
            title: 'Recent orders',
            pageSize: 8,
            sortable: true,
            searchable: true,
            columns: ['orderNumber', 'customer', 'status', 'quantity', 'orderDate'],
          },
        },
      ],
    },
  };
}

