import { requirePublishedForm } from '../../../lib/artifacts.js';
import { RecordForm } from '../../record-form.jsx';

export default async function PublishedForm({ params }) {
  const { id } = await params;
  const form = await requirePublishedForm(id);
  return <main><h1>{form.name}</h1><RecordForm form={form} /></main>;
}
