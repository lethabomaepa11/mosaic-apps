import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { previewProject, previewRuntime } from '#lib/server/preview';

/** Same-origin API for the preview app: forwards to the project's in-process Mosaic server as its admin. */
const forward: RequestHandler = async ({ params, request, url, locals }) => {
  if (!locals.user) throw error(401, 'Sign in to Mosaic Cloud to use this preview.');
  const project = await previewProject(params.slug, locals.user.id);
  if (!project) throw error(404, 'Preview not found');
  const { server, token } = await previewRuntime(project);
  const headers = new Headers({ authorization: `Bearer ${token}` });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
  const response = await server.app.request(`/api/${params.path ?? ''}${url.search}`, { method: request.method, headers, body });
  const out = new Headers(response.headers);
  out.delete('set-cookie'); // the preview's admin session never reaches the browser
  return new Response(response.body, { status: response.status, headers: out });
};

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
