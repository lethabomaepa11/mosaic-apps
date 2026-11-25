import { headers } from 'next/headers';
import { site } from '../lib/site.js';
import { canManagePages, readMosaic } from '../lib/artifacts.js';
import AppShell from './app-shell.jsx';
import './site.css';

export const metadata = { title: site.name };

export default async function Layout({ children }) {
  const cookies = (await headers()).get('cookie');
  const [pages, session] = await Promise.all([
    readMosaic('/pages?published=true'),
    cookies ? readMosaic('/auth/me') : null,
  ]);
  const nav = (pages.data ?? []).filter((page) => page.settings?.menu?.show !== false
    && /^\/(?![\/\\])/.test(page.route) && !/[\\\u0000-\u001f]/.test(page.route) && !page.route.split('/').some((part) => part.startsWith(':')))
    .sort((left, right) => (left.settings?.menu?.order ?? 99) - (right.settings?.menu?.order ?? 99));
  const links = nav.map((page) => ({ href: page.route, label: page.settings?.title ?? page.name }));
  return <html lang="en" data-theme={site.theme}><body>
    <AppShell name={site.name} links={links} signedIn={Boolean(session?.data)} showStudio={canManagePages(session?.data)} allowRegistration={process.env.AUTH !== 'off' && site.allowRegistration === true}>
      {children}
    </AppShell>
  </body></html>;
}
