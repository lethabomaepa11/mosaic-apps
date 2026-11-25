import { notFound } from 'next/navigation';
import { readMosaic, recordFormProps, requirePublishedForm, signIn } from '../../../lib/artifacts.js';
import { RecordForm } from '../../record-form.jsx';

export default async function PublishedForm({ params, searchParams }) {
  const { id } = await params;
  const form = await requirePublishedForm(id);
  const { record: recordId } = await searchParams;
  const entity = form.entity ?? form.dataSource?.entity;
  let record;
  if (entity && typeof recordId === 'string' && recordId) {
    const result = await readMosaic(`/entities/${encodeURIComponent(entity)}/${encodeURIComponent(recordId)}`);
    if (result.status === 401) signIn(`/f/${encodeURIComponent(id)}?record=${encodeURIComponent(recordId)}`);
    if (!result.data) notFound();
    record = result.data;
  }
  return <main><h1>{form.name}</h1><RecordForm {...await recordFormProps(form, record)} /></main>;
}
