import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCloudDb } from '#lib/server/db';
import type { ProjectBlueprint } from '#lib/server/groq';

export const load: PageServerLoad = async ({ params }) => {
  const db = await getCloudDb();
  const result = await db.query<{ name: string; slug: string; ui_theme: string; blueprint: ProjectBlueprint | null }>('SELECT name, slug, ui_theme, blueprint FROM cloud_projects WHERE slug = $1', [params.slug]);
  const project = result.rows[0];
  if (!project) throw error(404, 'Preview not found');
  const path = `/${params.path ?? ''}`.replace(/\/$/, '') || '/';
  const route = project.blueprint?.routes.find((item) => item.path === path) ?? project.blueprint?.routes.find((item) => item.path === '/');
  return { project, path, route };
};
