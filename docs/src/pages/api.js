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
      ['DELETE', '/api/entities/:e/:id', 'Soft delete (`?force=true` hard)'],
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
      ['GET', '/api/forms/:slug', 'Published form revision'],
      ['GET', '/api/ref-lists/:name', 'Reference list'],
    ],
  },
];

export default function ApiReference() {
  return (
    <Layout title="API reference" description="REST endpoints exposed by a Mosaic app.">
      <main className="container" style={{ padding: '3rem 0' }}>
        <h1>API reference</h1>
        <p>
          Every Mosaic app exposes the same REST surface under <code>/api</code>.
          See the <Link to="/docs/auto-crud">auto CRUD guide</Link> for query
          parameters, envelopes and error codes.
        </p>
        {groups.map((group) => (
          <section key={group.title} style={{ marginBottom: '2rem' }}>
            <h2>{group.title}</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {group.endpoints.map(([method, path, desc]) => (
                  <tr key={path} style={{ borderBottom: '1px solid var(--ifm-table-border-color)' }}>
                    <td style={{ padding: '6px 12px', whiteSpace: 'nowrap', width: 80 }}>
                      <code>{method}</code>
                    </td>
                    <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                      <code>{path}</code>
                    </td>
                    <td style={{ padding: '6px 12px' }}>{desc}</td>
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
