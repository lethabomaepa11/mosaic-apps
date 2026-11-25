import { notFound } from 'next/navigation';
import { canManagePages, canManageSettings, readMosaic, readNavigation, signIn } from '../../lib/artifacts.js';
import PageEditor from './page-editor.jsx';
import SidebarEditor from './sidebar-editor.jsx';

export default async function Studio({ searchParams }) {
  const { data: user } = await readMosaic('/auth/me');
  if (!user) signIn('/studio');
  const search = await searchParams;
  if ('sidebar' in search) {
    if (!canManageSettings(user)) notFound();
    return <main><SidebarEditor initial={await readNavigation()} /></main>;
  }
  if (!canManagePages(user)) notFound();
  const { data: pages } = await readMosaic('/pages');
  const selection = search.page;
  const selected = pages?.find((page) => page.id === selection);
  return <main>
    <h1>Page Studio</h1>
    {selected ? <PageEditor key={selected.id} page={selected} /> : <ul>
      {pages?.map((page) => <li key={page.id}><a href={`/studio?page=${encodeURIComponent(page.id)}`}>{page.name}</a> <code>{page.route}</code></li>)}
    </ul>}
  </main>;
}
