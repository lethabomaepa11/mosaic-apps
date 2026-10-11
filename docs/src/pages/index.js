import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

export default function Home() {
  return (
    <Layout title="Mosaic — metadata-driven full-stack platform" description="Model entities, migrate SQL, design forms with drag & drop, deploy an Hono API + SvelteKit PWA.">
      <header className="hero hero--primary" style={{ padding: '4rem 0' }}>
        <div className="container">
          <h1 className="hero__title">Mosaic</h1>
          <p className="hero__subtitle">
            Define entities. Get PostgreSQL tables, migrations, CRUD APIs, admin UIs, drag&nbsp;&amp;&nbsp;drop forms — and an installable PWA — from one JSON model.
          </p>
          <div className="buttons">
            <Link className="button button--secondary button--lg" to="/docs/intro">
              Get started in 5 minutes
            </Link>
          </div>
          <pre style={{ marginTop: 24, background: 'rgba(0,0,0,.35)', color: '#fff', padding: '12px 18px', borderRadius: 10, display: 'inline-block' }}>
            npx @mosaic-apps/cli create my-app
          </pre>
        </div>
      </header>
      <main>
        <section className="container" style={{ padding: '3rem 0' }}>
          <div className="row">
            {[
              ['🗃️', 'Entities → tables', 'Declare fields in JSON. The migration engine diffs metadata against Postgres and plans safe, reversible-where-possible SQL.'],
              ['🔌', 'Auto CRUD + auth', 'Instant REST with filters, sorts, pagination, relation labels, soft delete, audit, RBAC and ref-list pickers.'],
              ['🧱', '57 drag & drop components', 'Inputs, data grids, layouts, charts, feedback — all stored as JSON, rendered anywhere, versioned and publishable.'],
              ['📱', 'Installable PWA', 'Every generated web app ships installable: precached shell, offline forms, background-sync-friendly API design.'],
            ].map(([icon, title, text]) => (
              <div className="col col--3" key={title}>
                <div className="card" style={{ height: '100%' }}>
                  <div className="card__header"><h3>{icon} {title}</h3></div>
                  <div className="card__body"><p>{text}</p></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
