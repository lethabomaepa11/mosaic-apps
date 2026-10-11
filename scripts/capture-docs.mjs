import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:3000';
const folder = 'docs/static/img/screenshots';
await mkdir(folder, { recursive: true });
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@mosaic.local', password: 'admin1234' }) }).then((response) => response.json());
assert.ok(login.success);
const headers = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' };
const api = async (path, method = 'GET', body) => {
  const response = await fetch(`${base}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  assert.ok(response.ok, JSON.stringify(result));
  return result.data;
};
const node = (id, type, props = {}, children) => ({ id, type, props, ...(children ? { children } : {}) });
const form = await api('/forms', 'POST', { name: 'Customer intake', slug: `docs-customer-${Date.now()}`, schema: node('docs-root', 'form', {}, [
  node('docs-card', 'card', { title: 'Customer profile', subtitle: 'Capture contact details and preferences.' }, [
    node('docs-name', 'textField', { label: 'Full name', binding: 'name', placeholder: 'Alex Morgan', required: true }),
    node('docs-email', 'textField', { label: 'Email address', binding: 'email', placeholder: 'alex@example.com' }),
    node('docs-status', 'selectField', { label: 'Relationship', binding: 'status', options: [{ value: 'prospect', label: 'Prospect' }, { value: 'active', label: 'Active customer' }] }),
    node('docs-date', 'datePicker', { label: 'Start date', binding: 'startDate' }),
    node('docs-notes', 'textArea', { label: 'Notes', binding: 'notes', placeholder: 'Add useful context for your team.' }),
    node('docs-news', 'switch', { label: 'Receive product updates', binding: 'updates' }),
  ]),
  node('docs-script', 'button', { label: 'Prepare customer', actions: [{ type: 'script', language: 'typescript', source: "const name = String(state.form.name ?? '').trim();\nif (!name) {\n  return [api.message.warning('Enter a customer name')];\n}\nreturn [\n  api.state.set('form', 'name', name),\n  api.message.success('Customer details prepared'),\n];" }] }),
]), settings: { submitLabel: 'Create customer', showReset: true, resetLabel: 'Clear form', seo: { title: 'Customer intake', description: 'Create a customer profile.' } } });
const dashboard = await api('/pages', 'POST', { name: 'Customer workspace', slug: `docs-workspace-${Date.now()}`, route: '/customer-workspace', schema: node('docs-page', 'page', {}, [
  node('docs-title', 'heading', { text: 'Customer workspace', level: 2 }),
  node('docs-stats', 'grid', { columns: 3 }, [node('docs-stat1', 'statCard', { label: 'Active customers', value: '248', trend: 'This month' }), node('docs-stat2', 'statCard', { label: 'New prospects', value: '32', trend: 'Ready for follow-up' }), node('docs-stat3', 'statCard', { label: 'Open requests', value: '12', trend: 'Assigned to your team' })]),
  node('docs-alert', 'alert', { title: 'Weekly review', text: 'Review the latest customer records with your team.', variant: 'info' }),
  node('docs-table', 'dataTable', { columns: [{ key: 'name', label: 'Customer', sortable: true }, { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' }], rows: [{ name: 'Alex Morgan', email: 'alex@example.com', status: 'Active' }, { name: 'Sam Taylor', email: 'sam@example.com', status: 'Prospect' }, { name: 'Jordan Lee', email: 'jordan@example.com', status: 'Active' }] }),
]), settings: { layout: 'default', menu: { show: true, group: 'Customers', order: 1 }, seo: { title: 'Customer workspace' } } });
const browser = await chromium.launch({ executablePath: process.env.MOSAIC_BROWSER_EXECUTABLE_PATH ?? (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined), headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.addInitScript((token) => localStorage.setItem('mosaic_token', token), login.data.token);
const shot = async (name) => page.screenshot({ path: `${folder}/${name}.png`, animations: 'disabled' });
const editMonaco = async (dialog, text) => {
  const editor = dialog.locator('.monaco-editor');
  await editor.waitFor({ timeout: 30000 });
  await editor.locator('.view-lines').click();
  await page.keyboard.press('Control+A');
  if (text) {
    await page.evaluate((value) => navigator.clipboard.writeText(value), text);
    await page.keyboard.press('Control+V');
  }
  else await page.keyboard.press('Backspace');
  await page.waitForFunction(({ expected }) => document.querySelector('[role="dialog"] .view-lines')?.textContent?.replaceAll('\u00a0', ' ').includes(expected.split('\n')[0]), { expected: text });
};
try {
  await page.goto(`${base}/studio/forms/${form.id}`);
  await page.getByRole('button', { name: 'Form settings', exact: true }).waitFor();
  await page.locator('.layer-row > button').filter({ hasText: 'textField' }).first().click();
  await shot('form-studio');
  await page.getByRole('tab', { name: 'Logic', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Visible when expression', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Visible when expression', exact: true });
  await editMonaco(dialog, "form.status === 'active'");
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Visible when expression', exact: true }).click();
  await dialog.locator('.monaco-editor').waitFor();
  assert.ok((await dialog.locator('.view-lines').innerText()).trim() === '', 'Cancel must discard expression edits');
  await editMonaco(dialog, "form.status === 'active'");
  await shot('condition-editor');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Visible when expression', exact: true }).click();
  await editMonaco(dialog, '');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  const visibility = page.locator('.condition-editor').first();
  await visibility.locator('button[aria-label="Condition type"]').click();
  await page.getByRole('option', { name: 'JavaScript / TypeScript', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Visible when script', exact: true });
  await editMonaco(dialog, "return state.form.status !== 'blocked';");
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await visibility.getByRole('button', { name: 'Edit Visible when expression', exact: true }).waitFor();
  await visibility.locator('button[aria-label="Condition type"]').click();
  await page.getByRole('option', { name: 'JavaScript / TypeScript', exact: true }).click();
  await editMonaco(dialog, "return state.form.status !== 'blocked';");
  await shot('condition-script');
  await dialog.getByRole('button', { name: 'Apply condition', exact: true }).click();
  await visibility.getByRole('button', { name: 'Edit Visible when script', exact: true }).waitFor();
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Form JSON', exact: true });
  await dialog.locator('.monaco-editor').waitFor();
  await shot('json-editor');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByText('button', { exact: true }).last().click();
  await page.getByRole('tab', { name: 'Actions', exact: true }).click();
  await page.getByRole('button', { name: 'Edit script', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Execute script', exact: true });
  await dialog.locator('.monaco-editor').waitFor();
  await shot('execute-script');
  await editMonaco(dialog, 'api.');
  await page.keyboard.press('Control+Space');
  const suggestions = dialog.locator('.suggest-widget.visible');
  await suggestions.waitFor({ timeout: 15000 });
  await suggestions.getByText('callApi', { exact: true }).waitFor({ timeout: 20000 });
  assert.match(await suggestions.innerText(), /callApi|message|navigate|state/);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Form settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Form settings', exact: true }).waitFor();
  await shot('form-settings');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.locator('.designer-preview__page').waitFor();
  await page.locator('.designer-preview__page').screenshot({ path: `${folder}/input-components.png`, animations: 'disabled' });
  await page.getByRole('button', { name: 'Open calendar', exact: true }).click();
  await page.locator('.m-date-picker__content').waitFor();
  await shot('date-picker');
  await page.keyboard.press('Escape');
  await page.goto(`${base}/studio/pages/${dashboard.id}`);
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Page settings', exact: true }).waitFor();
  await shot('page-settings');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.locator('.page-preview__surface').waitFor();
  await page.locator('.page-preview__surface').screenshot({ path: `${folder}/dashboard-components.png`, animations: 'disabled' });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByText('dataTable', { exact: true }).last().click();
  await page.getByRole('button', { name: /Edit Columns/, exact: false }).click();
  dialog = page.getByRole('dialog', { name: /Columns/ });
  await editMonaco(dialog, '{broken json');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  assert.equal(await dialog.count(), 1);
  await editMonaco(dialog, JSON.stringify([{ key: 'name', label: 'Customer' }], null, 2));
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Screenshots captured; condition/script modals, runtime autocomplete, Cancel/Apply, and JSON validation verified; no browser exceptions.');
} finally {
  await browser.close();
  await api(`/forms/${form.id}`, 'DELETE');
  await api(`/pages/${dashboard.id}`, 'DELETE');
}
