import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Acceptance against installed packages; shared by local and packed consumer checks. */
export async function verifyWorkflows(browser, { api, studio, web, evidence }) {
  await mkdir(evidence, { recursive: true });
  const login = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@mosaic.local', password: 'admin1234' }) }).then(r => r.json());
  assert.ok(login.success);
  const token = login.data.token;
  async function call(path, method = 'GET', body) {
    const response = await fetch(`${api}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const json = await response.json();
    assert.ok(response.ok && json.success, `${method} ${path}: ${response.status} ${JSON.stringify(json)}`);
    return json.data;
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(value => localStorage.setItem('mosaic_token', value), token);
  const page = await context.newPage(); page.setDefaultTimeout(60_000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${studio}/data/entities/customer`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Create application views', exact: true }).click();
    const wizard = page.getByRole('dialog', { name: 'Create application views' });
    const name = `Account workflow ${Date.now()}`;
    await wizard.getByLabel('Workflow name', { exact: true }).fill(name);
    const generated = page.waitForResponse(r => r.url().endsWith('/api/workflows/entity') && r.request().method() === 'POST');
    await wizard.getByRole('button', { name: 'Create and publish views' }).click();
    const response = await generated; assert.equal(response.status(), 201);
    const workflow = (await response.json()).data;
    await page.goto(`${web}/p/${workflow.page.slug}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Add Customer', exact: true }).click();
    await page.waitForURL(`**/f/${workflow.forms.create.id}`);
    const recordName = `Business account ${Date.now()}`;
    await page.getByLabel(/^Name/).fill(recordName);
    await page.getByLabel('Email', { exact: true }).fill('acceptance@example.test');
    await page.getByRole('button', { name: 'Create Customer', exact: true }).click();
    await page.waitForURL(`**/p/${workflow.page.slug}`);
    const row = () => page.getByRole('row').filter({ hasText: recordName });
    await row().getByRole('button', { name: 'View', exact: true }).click();
    await page.waitForURL(`**/f/${workflow.forms.detail.id}?id=*`);
    await page.getByLabel(/^Name/).waitFor();
    await page.waitForFunction(value => [...document.querySelectorAll('input')].some(input => input.value === value && input.disabled), recordName);
    assert.equal(await page.getByRole('button', { name: 'Save changes', exact: true }).count(), 0);
    await page.getByRole('button', { name: `Back to ${name}`, exact: true }).click();
    await page.waitForURL(`**/p/${workflow.page.slug}`);
    await row().getByRole('button', { name: 'Edit', exact: true }).click();
    await page.waitForURL(`**/f/${workflow.forms.edit.id}?id=*`);
    await page.getByLabel(/^Name/).fill(`${recordName} updated`);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.waitForURL(`**/p/${workflow.page.slug}`);
    await row().waitFor();
    await page.screenshot({ path: join(evidence, 'workflow-table.png'), fullPage: true });

    workflow.page.root.children[0].props.rowActions = [{ id: 'approve', label: 'Approve account', actions: [{ type: 'script', language: 'typescript', source: `const record: Record<string, unknown> = state.data;
return [api.confirm({ title: 'Approve this account?', confirmLabel: 'Approve' }), api.call('PATCH', '/entities/customer/' + record.id, { name: String(record.name) + ' approved' }), api.state.set('application', 'lastApproved', record.id)];` }] }];
    await call(`/pages/${workflow.page.id}/save-and-publish`, 'PUT', { ...workflow.page, expectedVersion: workflow.page.version });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await row().getByRole('button', { name: 'Approve account', exact: true }).click();
    let confirm = page.getByRole('dialog', { name: 'Approve this account?' });
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
    await confirm.waitFor({ state: 'hidden' });
    assert.equal(await row().filter({ hasText: 'approved' }).count(), 0);
    await row().getByRole('button', { name: 'Approve account', exact: true }).click();
    confirm = page.getByRole('dialog', { name: 'Approve this account?' });
    await page.screenshot({ path: join(evidence, 'row-action-confirmation.png'), fullPage: true });
    await confirm.getByRole('button', { name: 'Approve', exact: true }).click();
    await row().filter({ hasText: 'approved' }).waitFor();

    await page.goto(`${studio}/design/pages/${workflow.page.id}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const inline = page.getByRole('main', { name: 'Inline page preview' });
    await inline.getByRole('button', { name: 'Add Customer', exact: true }).click();
    await inline.getByLabel(/^Name/).waitFor();
    assert.equal(page.url(), `${studio}/design/pages/${workflow.page.id}`);
    assert.equal(await page.getByRole('dialog').count(), 0);
    await inline.getByRole('button', { name: 'Back to original preview', exact: true }).click();
    await inline.getByRole('button', { name: 'View', exact: true }).first().click();
    await inline.getByLabel(/^Name/).waitFor();
    assert.ok(await inline.getByLabel(/^Name/).isDisabled());
    await page.screenshot({ path: join(evidence, 'inline-navigation-preview.png'), fullPage: true });

    const definition = await call(`/pages/${workflow.page.id}`);
    await call(`/pages/${workflow.page.id}/save-and-publish`, 'PUT', { settings: { ...definition.settings, layout: 'bare' }, expectedVersion: definition.version });
    await page.goto(`${web}/p/${workflow.page.slug}`, { waitUntil: 'domcontentloaded' });
    await row().waitFor();
    assert.equal(await page.locator('nav.app-nav').count(), 0);

    await page.goto(`${studio}/settings`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Theme', exact: true }).click();
    await page.getByRole('button', { name: 'Ocean', exact: true }).click();
    await page.getByLabel('New theme name', { exact: true }).fill('Acceptance theme');
    await page.getByRole('button', { name: 'Save as named theme', exact: true }).click();
    await page.getByRole('button', { name: 'Acceptance theme', exact: true }).waitFor();
    await page.getByRole('button', { name: 'View Theme export', exact: true }).click();
    const themeModal = page.getByRole('dialog', { name: 'Theme export' });
    await themeModal.locator('.monaco-editor .view-lines').waitFor();
    await themeModal.getByRole('button', { name: 'Close', exact: true }).last().click();
    const saveTheme = page.waitForResponse(r => r.url().endsWith('/api/settings/theme.config') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save theme', exact: true }).click();
    assert.equal((await saveTheme).status(), 200);
    await page.screenshot({ path: join(evidence, 'theme-gallery.png'), fullPage: true });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDqoAAAAASUVORK5CYII=', 'base64');
    const uploaded = page.waitForResponse(r => r.url().endsWith('/api/files') && r.request().method() === 'POST');
    await page.getByLabel('Upload logo', { exact: true }).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
    const upload = await uploaded; assert.equal(upload.status(), 201);
    const file = (await upload.json()).data;
    await page.getByLabel('Logo URL', { exact: true }).inputValue().then(value => assert.equal(value, `/files/${file.id}`));
    await page.getByLabel('Application name', { exact: true }).fill('Acceptance CRM');
    const saveBrand = page.waitForResponse(r => r.url().endsWith('/api/settings/app.logo') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save branding', exact: true }).click();
    assert.equal((await saveBrand).status(), 200);
    assert.equal((await fetch(`${api.replace(/\/api$/, '')}/files/${file.id}`)).status, 200);
    await page.goto(`${web}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('.app-nav__brand').filter({ hasText: 'Acceptance CRM' }).waitFor();
    const logo = page.locator('.app-nav__brand img');
    await logo.waitFor(); await logo.evaluate(image => image.decode());
    assert.deepEqual(errors, [], 'Business workflow has browser runtime exceptions.');
    console.log('[mosaic] workflow browser passed: wizard, linked CRUD, readonly detail, script row context, confirmation, inline preview navigation, bare layout, named themes, Monaco and public uploaded branding.');
  } catch (error) {
    await page.screenshot({ path: join(evidence, 'workflow-failure.png'), fullPage: true }).catch(() => {});
    console.error('Workflow failure URL:', page.url(), errors);
    throw error;
  } finally { await context.close(); }
}
