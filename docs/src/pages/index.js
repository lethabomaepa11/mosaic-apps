import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

export default function Home() {
  return (
    <Layout title="Documentation" description="Build with Mosaic Cloud or create an application with the Mosaic framework.">
      <main className="container docs-home">
        <header className="docs-hero">
          <h1>Mosaic documentation</h1>
          <p>Build business applications with database-backed pages, forms, and workflows.</p>
        </header>
        <section className="docs-paths" aria-label="Getting started">
          <Link className="docs-path" to="/docs/quickstart">
            <h2>Build with the framework</h2>
            <p>Create a SvelteKit or Next.js app locally and work in your own repository.</p>
            <span>Local quickstart <span aria-hidden="true">→</span></span>
          </Link>
          <Link className="docs-path" to="/docs/cloud-studio">
            <h2>Build with Mosaic Cloud</h2>
            <p>Turn a brief into a preview, then download the source or deliver through connected providers.</p>
            <span>Cloud guide <span aria-hidden="true">→</span></span>
          </Link>
        </section>
        <nav className="docs-shortcuts" aria-label="Popular guides">
          <Link to="/docs/builder">Studio</Link>
          <Link to="/docs/auto-crud">Data API</Link>
          <Link to="/docs/extensions#server-extensions">Server extensions</Link>
          <Link to="/docs/deployment">Deployment</Link>
        </nav>
      </main>
    </Layout>
  );
}
