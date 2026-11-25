import { publishedForm, readMosaic } from '../lib/artifacts.js';
import { RecordForm } from './record-form.jsx';

function safeLink(value) {
  return typeof value === 'string' && (/^https?:\/\//i.test(value) || /^\/(?![\/\\])/.test(value) && !value.includes('\\')) ? value : undefined;
}

function Table({ rows = [], columns = [] }) {
  if (!rows.length) return <p>No records</p>;
  return (
    <table>
      <thead><tr>{columns.map((col) => <th key={col.key} scope="col">{col.label ?? col.key}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row.id ?? index}>{columns.map((col) =>
        <td key={col.key}>{row[col.key] == null ? '' : String(row[col.key])}</td>,
      )}</tr>)}</tbody>
    </table>
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
      return href ? <a href={href}>{props.label}</a> : null;
    }
    case 'dataTable':
      return <Table rows={Array.isArray(props.rows) ? props.rows : []} columns={Array.isArray(props.columns) ? props.columns : []} />;
    case 'entityTable': {
      if (typeof props.entity !== 'string' || !props.entity) return null;
      const result = await readMosaic(`/entities/${encodeURIComponent(props.entity)}?pageSize=20`);
      if (!result.data) return <p>Records unavailable.</p>;
      const rows = Array.isArray(result.data) ? result.data : result.data.data ?? [];
      const columns = props.columns?.length ? props.columns.map((col) => typeof col === 'string' ? { key: col } : col) : Object.keys(rows[0] ?? {}).map((key) => ({ key }));
      return <section>{props.title && <h2>{props.title}</h2>}<Table rows={rows} columns={columns} /></section>;
    }
    case 'subform': {
      const form = await publishedForm(props.formId);
      return form ? <RecordForm form={form} /> : null;
    }
    default:
      return <section>{props.title && <h2>{props.title}</h2>}{node.children?.map((child) => <MosaicNode key={child.id} node={child} />)}</section>;
  }
}
