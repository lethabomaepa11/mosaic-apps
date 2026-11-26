import { publishedPage } from '../lib/artifacts.js';
import { MosaicNode } from './mosaic-node.jsx';
import { FrameworkArtifact } from './framework-artifact.jsx';

export default async function Home({ searchParams }) {
  const page = await publishedPage([]);
  if (page) {
    const query = Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value.at(-1) : value]));
    return <main className="published-page">
      <FrameworkArtifact artifact={{ page, scope: { params: {}, query } }}><MosaicNode node={page.root} /></FrameworkArtifact>
    </main>;
  }
  return (
    <main style={{ maxWidth: 640, margin: '4rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Mosaic on Next.js</h1>
      <p>This App Router example serves the Mosaic API at the same origin as the app.</p>
      <ul>
        <li><a href="/api/health">API health</a></li>
        <li><a href="/api/meta">Platform metadata</a></li>
        <li><a href="/api/pages?published=true">Published pages</a></li>
      </ul>
    </main>
  );
}
