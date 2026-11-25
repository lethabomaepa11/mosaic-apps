import type { AppSpec } from '../../src/lib/server/spec';

const field = (name: string, label: string, type: AppSpec['entities'][number]['fields'][number]['type'], extra: Partial<AppSpec['entities'][number]['fields'][number]> = {}) =>
  ({ name, label, type, required: false, unique: false, searchable: false, options: [], refEntity: '', format: '' as const, ...extra });
const open = { read: [], create: [], update: [], delete: ['admin'] };

export const equipmentSpec: AppSpec = {
  name: 'Equipment loans', summary: 'Track company equipment and who has it.', roles: ['admin', 'staff'], workflows: ['Lend equipment', 'Return equipment'],
  entities: [
    { name: 'employee', label: 'Employee', labelPlural: 'Employees', icon: 'users', description: 'People who borrow equipment', labelField: 'fullName', permissions: open,
      fields: [field('fullName', 'Full name', 'string', { required: true, searchable: true }), field('email', 'Email', 'string', { format: 'email' as const, unique: true })] },
    { name: 'equipment', label: 'Equipment', labelPlural: 'Equipment', icon: 'box', description: 'Items available to lend', labelField: 'name', permissions: open,
      fields: [field('name', 'Name', 'string', { required: true, searchable: true }), field('serialNumber', 'Serial number', 'string', { unique: true }), field('status', 'Status', 'enum', { options: ['Available', 'On loan', 'Retired'], required: true })] },
    { name: 'loan', label: 'Loan', labelPlural: 'Loans', icon: 'clipboard', description: 'A piece of equipment lent to an employee', labelField: 'reference', permissions: open,
      fields: [field('reference', 'Reference', 'string', { required: true }), field('item', 'Equipment', 'ref', { refEntity: 'equipment', required: true }), field('borrower', 'Borrower', 'ref', { refEntity: 'employee', required: true }),
        field('dueDate', 'Due date', 'date', { required: true }), field('returned', 'Returned', 'boolean'), field('notes', 'Notes', 'text')] },
  ],
  pages: [
    { slug: 'home', title: 'Equipment loans', route: '/', kind: 'home', entity: '', description: 'Welcome', access: 'public', inMenu: true, icon: 'home' },
    { slug: 'dashboard', title: 'Dashboard', route: '/dashboard', kind: 'dashboard', entity: 'loan', description: 'Overview', access: 'authenticated', inMenu: true, icon: 'grid' },
    { slug: 'equipment', title: 'Equipment', route: '/equipment', kind: 'list', entity: 'equipment', description: 'All items', access: 'authenticated', inMenu: true, icon: 'box' },
    { slug: 'employees', title: 'Employees', route: '/employees', kind: 'list', entity: 'employee', description: 'All people', access: 'authenticated', inMenu: true, icon: 'users' },
    { slug: 'loans', title: 'Loans', route: '/loans', kind: 'list', entity: 'loan', description: 'All loans', access: 'authenticated', inMenu: true, icon: 'clipboard' },
  ],
  sampleData: [
    { entity: 'employee', records: [[{ field: 'fullName', value: 'Thandi Nkosi' }, { field: 'email', value: 'thandi@example.com' }]] },
    { entity: 'equipment', records: [[{ field: 'name', value: 'Dell laptop' }, { field: 'serialNumber', value: 'DL-001' }, { field: 'status', value: 'On loan' }]] },
    { entity: 'loan', records: [[{ field: 'reference', value: 'LN-1' }, { field: 'item', value: 'Dell laptop' }, { field: 'borrower', value: 'Thandi Nkosi' }, { field: 'dueDate', value: '2026-12-01' }]] },
  ],
};
