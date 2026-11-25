import { notFound } from 'next/navigation';
import { publishedPage } from '../../lib/artifacts.js';
import { MosaicNode } from '../mosaic-node.jsx';

export default async function PublishedPage({ params }) {
  const { path } = await params;
  const page = await publishedPage(path);
  if (!page) notFound();
  return <main className="published-page"><MosaicNode node={page.root} /></main>;
}
