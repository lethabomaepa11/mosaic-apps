import { mosaicServer } from '../../../lib/mosaic.js';

export const runtime = 'nodejs';

async function handle(request) {
  return (await mosaicServer()).app.fetch(request);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as OPTIONS };
