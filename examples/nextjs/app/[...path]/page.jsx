import { notFound } from 'next/navigation';
import { publishedPage } from '../../lib/artifacts.js';
import { MosaicNode } from '../mosaic-node.jsx';
import { FrameworkArtifact } from '../framework-artifact.jsx';

export default async function PublishedPage({ params, searchParams }) {
  const { path } = await params;
  const page = await publishedPage(path);
  if (!page) notFound();
  const routeParams = Object.fromEntries(page.route.split('/').filter(Boolean).flatMap((part, index) =>
    part.startsWith(':') ? [[part.slice(1), path[index]]] : [],
  ));
  const query = Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value.at(-1) : value]));
  return <main className="published-page">
    <FrameworkArtifact artifact={{ page, scope: { params: routeParams, query } }}><MosaicNode node={page.root} /></FrameworkArtifact>
  </main>;
}
