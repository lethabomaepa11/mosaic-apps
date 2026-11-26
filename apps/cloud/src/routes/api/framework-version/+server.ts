import { json } from '@sveltejs/kit';
import { frameworkVersion } from '#lib/server/template';

export function GET() {
  return json({ nextjs: frameworkVersion('nextjs'), sveltekit: frameworkVersion('sveltekit') }, {
    headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=60' },
  });
}
