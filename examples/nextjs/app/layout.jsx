import { headers } from 'next/headers';
import { site } from '../lib/site.js';
import { canManagePages, canManageSettings, readMosaic, readNavigation } from '../lib/artifacts.js';
import AppShell from './app-shell.jsx';
import './site.css';

export const metadata = { title: site.name };

export default async function Layout({ children }) {
  const cookies = (await headers()).get('cookie');
  const [links, session] = await Promise.all([
    readNavigation(),
    cookies ? readMosaic('/auth/me') : null,
  ]);
  return <html lang="en" data-theme={site.theme}><body>
    <AppShell name={site.name} links={links} signedIn={Boolean(session?.data)} showStudio={canManagePages(session?.data)} editSidebar={canManageSettings(session?.data)} allowRegistration={process.env.AUTH !== 'off' && site.allowRegistration === true}>
      {children}
    </AppShell>
  </body></html>;
}
