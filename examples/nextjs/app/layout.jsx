import { headers } from 'next/headers';
import { site } from '../lib/site.js';
import { readMosaic } from '../lib/artifacts.js';
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
  return <html lang="en" data-theme={site.theme}><body>
    <header className="site-nav">
      <a className="site-name" href="/">{site.name}</a>
      <nav aria-label="Main">{nav.filter((page) => page.route !== '/').map((page) => <a key={page.id} href={page.route}>{page.settings?.title ?? page.name}</a>)}</nav>
      {!session?.data && <a href="/login">Sign in</a>}
    </header>
    {children}
  </body></html>;
}
