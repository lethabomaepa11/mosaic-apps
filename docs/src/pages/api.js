import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

const groups = [
  {
    title: 'Auth',
    endpoints: [
      ['POST', '/api/auth/register', 'Create account'],
      ['POST', '/api/auth/login', 'Start session'],
      ['POST', '/api/auth/logout', 'End session'],
      ['GET', '/api/auth/me', 'Current user'],
      ['POST', '/api/auth/change-password', 'Change password'],
    ],
  },
  {
    title: 'Entities',
    endpoints: [
      ['GET', '/api/entities', 'Registry of registered entities'],
      ['GET', '/api/entities/:e/meta', 'Entity metadata + endpoints'],
      ['GET', '/api/entities/:e/options', 'Picker data (`value`, `label`)'],
      ['GET', '/api/entities/:e', 'List (filter, sort, paginate)'],
      ['GET', '/api/entities/:e/:id', 'Single record'],
      ['POST', '/api/entities/:e', 'Create (201; invalid → 422)'],
      ['PATCH', '/api/entities/:e/:id', 'Partial update (audit diff)'],
      ['DELETE', '/api/entities/:e/:id', 'Delete a record'],
      ['PUT', '/api/entities/:e', 'Replace definition (admin)'],
      ['DELETE', '/api/entities/:e', 'Unregister definition (admin)'],
      ['POST', '/api/entities/validate', 'Validate definition only'],
    ],
  },
  {
    title: 'System',
    endpoints: [
      ['GET', '/api/health', 'Health probe `{ ok, version, db }`'],
      ['GET', '/api/migrations', 'Migration history'],
      ['GET', '/api/forms/:slug', 'Form definition'],
      ['GET', '/api/ref-lists/:name', 'Reference list'],
    ],
  },
];

export default function ApiReference() {
  return (
    <Layout title="API reference" description="REST endpoints exposed by a Mosaic app.">
      <main className="container docs-home docs-api">
        <h1>API reference</h1>
        <p>
          Mosaic exposes standard routes under <code>/api</code>. See the
          {' '}<Link to="/docs/auto-crud">data API guide</Link> for query parameters and errors,
          or <Link to="/docs/extensions#server-extensions">server extensions</Link> for custom endpoints.
        </p>
        {groups.map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            <table>
              <thead><tr><th scope="col">Method</th><th scope="col">Path</th><th scope="col">Purpose</th></tr></thead>
              <tbody>
                {group.endpoints.map(([method, path, desc]) => (
                  <tr key={`${method} ${path}`}>
                    <td>
                      <code>{method}</code>
                    </td>
                    <td>
                      <code>{path}</code>
                    </td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </main>
    </Layout>
  );
}
