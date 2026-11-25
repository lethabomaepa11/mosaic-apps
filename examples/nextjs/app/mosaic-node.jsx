import { publishedForm, readMosaic, recordFormProps } from '../lib/artifacts.js';
import { RecordForm } from './record-form.jsx';

function safeLink(value) {
  return typeof value === 'string' && (/^https?:\/\//i.test(value) || /^\/(?![\/\\])/.test(value) && !value.includes('\\')) ? value : undefined;
}

function Table({ rows = [], columns = [], editHref }) {
  if (!rows.length) return <p>No records</p>;
  return (
    <div className="table-scroll"><table>
      <thead><tr>{columns.map((col) => <th key={col.key} scope="col">{col.label ?? col.key}</th>)}{editHref && <th scope="col">Actions</th>}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row.id ?? index}>{columns.map((col) =>
        <td key={col.key}>{row[col.key] == null ? '' : String(row[col.key])}</td>,
      )}{editHref && <td><a href={editHref(row)}>Edit</a></td>}</tr>)}</tbody>
    </table></div>
  );
}

export async function MosaicNode({ node }) {
  const props = node.props ?? {};
  if (props.visibleIf === 'false') return null;
  switch (node.type) {
    case 'heading': {
      const Heading = `h${Math.max(1, Math.min(4, Number(props.level) || 1))}`;
      return <Heading>{props.text}</Heading>;
    }
    case 'text':
    case 'badge':
    case 'alert':
      return <p>{props.text ?? props.label ?? props.title}</p>;
    case 'divider':
      return <hr />;
    case 'button':
    case 'iconButton': {
      const action = (props.events?.onclick ?? props.actions)?.[0];
      const href = safeLink(action?.type === 'navigate' && action.target === 'form' ? `/f/${encodeURIComponent(action.to)}` : action?.type === 'navigate' && action.target === 'url' ? action.to : props.href);
      return href ? <a className="workflow-action" href={href}>{props.label}</a> : null;
    }
    case 'card':
      return <section className="workflow-card">{props.title && <h2>{props.title}</h2>}{node.children?.map((child) => <MosaicNode key={child.id} node={child} />)}</section>;
    case 'dataTable':
      return <Table rows={Array.isArray(props.rows) ? props.rows : []} columns={Array.isArray(props.columns) ? props.columns : []} />;
    case 'statCard': {
      if (!props.entity) return null;
      const { data } = await readMosaic(`/entities/${encodeURIComponent(props.entity)}?pageSize=1`);
      return data ? <p><strong>{props.label ?? props.entity}</strong> {data.total}</p> : null;
    }
    case 'entityTable': {
      if (typeof props.entity !== 'string' || !props.entity) return null;
      const pageSize = Math.max(1, Math.min(100, Number(props.pageSize) || 20));
      const result = await readMosaic(`/entities/${encodeURIComponent(props.entity)}?pageSize=${pageSize}`);
      if (!result.data) return <p>Records unavailable.</p>;
      const rows = Array.isArray(result.data) ? result.data : result.data.data ?? [];
      const columns = Array.isArray(props.columns) && props.columns.length ? props.columns.map((col) => typeof col === 'string' ? { key: col } : col) : Object.keys(rows[0] ?? {}).map((key) => ({ key }));
      const { data: forms } = await readMosaic('/forms?published=true');
      const form = forms?.find((item) => (item.entity ?? item.dataSource?.entity) === props.entity);
      const url = form && '/f/' + encodeURIComponent(form.slug);
      return <section>{props.title && <h2>{props.title}</h2>}
        {url && props.allowCreate && <a href={url}>New record</a>}
        <Table rows={rows} columns={columns} editHref={url && props.allowEdit ? (row) => `${url}?record=${encodeURIComponent(row.id)}` : undefined} />
      </section>;
    }
    case 'subform': {
      const form = await publishedForm(props.formId);
      return form ? <RecordForm {...await recordFormProps(form)} /> : null;
    }
    default:
      return <section>{props.title && <h2>{props.title}</h2>}{node.children?.map((child) => <MosaicNode key={child.id} node={child} />)}</section>;
  }
}
