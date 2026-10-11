import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function Home() {
  const screenshot = useBaseUrl('/img/screenshots/form-studio.png');
  return (
    <Layout title="Mosaic — build business applications" description="Model business records, design forms and pages, and deploy your own application.">
      <header className="hero hero--primary" style={{ padding: '4rem 0' }}>
        <div className="container">
          <h1 className="hero__title">Mosaic</h1>
          <p className="hero__subtitle">Model your records. Design your workflows. Build your business application.</p>
          <p>Forms, pages, tables, actions, and custom code in one Studio.</p>
          <Link className="button button--secondary button--lg" to="/docs/quickstart">Create your first app</Link>
        </div>
      </header>
      <main className="container" style={{ padding: '3rem 0' }}>
        <img src={screenshot} alt="Customer intake form in Mosaic Studio with the palette and property inspector" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--ifm-color-emphasis-200)' }} />
        <div className="row" style={{ marginTop: 32 }}>
          {[
            ['Model your data', 'Define entities and relations, review database migrations, and use generated CRUD APIs.'],
            ['Design the interface', 'Build forms and pages with 59 component types. Preview inline and save to publish.'],
            ['Extend behavior', 'Configure API calls, navigation, and state updates, or write custom JS/TS in a Monaco modal.'],
            ['Run your own app', 'Use editable generated source and deploy your database, backend, and frontend to your chosen hosts.'],
          ].map(([title, text]) => (
            <div className="col col--3" key={title}><h2 className="h3">{title}</h2><p>{text}</p></div>
          ))}
        </div>
        <p><Link to="/docs/components/gallery">Explore components</Link> · <Link to="/docs/builder">Learn Studio</Link> · <Link to="/docs/deployment">Deploy an application</Link> · <Link to="/docs/roadmap">Road to v1</Link></p>
      </main>
    </Layout>
  );
}
