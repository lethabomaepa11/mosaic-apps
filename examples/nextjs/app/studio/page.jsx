import { notFound } from 'next/navigation';
import { canManagePages, readMosaic, signIn } from '../../lib/artifacts.js';
import PageEditor from './page-editor.jsx';

export default async function Studio({ searchParams }) {
  const { data: user } = await readMosaic('/auth/me');
  if (!user) signIn('/studio');
  if (!canManagePages(user)) notFound();
  const { data: pages } = await readMosaic('/pages');
  const selection = (await searchParams).page;
  const selected = pages?.find((page) => page.id === selection);
  return <main>
    <h1>Page Studio</h1>
    {selected ? <PageEditor key={selected.id} page={selected} /> : <ul>
      {pages?.map((page) => <li key={page.id}><a href={`/studio?page=${encodeURIComponent(page.id)}`}>{page.name}</a> <code>{page.route}</code></li>)}
    </ul>}
  </main>;
}
