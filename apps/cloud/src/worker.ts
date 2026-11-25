import { setTimeout as sleep } from 'node:timers/promises';
import { getCloudDb } from './lib/server/db';
import { claimJob, runJob } from './lib/server/jobs';
import { drainPreviewCleanup } from './lib/server/preview-schema';

const shutdown = new AbortController();
process.once('SIGINT', () => shutdown.abort());
process.once('SIGTERM', () => shutdown.abort());

const db = await getCloudDb();
try {
  while (!shutdown.signal.aborted) {
    try {
      await drainPreviewCleanup(db).catch((cause) => console.error('Preview cleanup failed', cause));
      const job = await claimJob(db);
      if (job) { await runJob(db, job); continue; }
    } catch (cause) {
      console.error('Cloud worker could not process the queue', cause);
    }
    await sleep(2_000, undefined, { signal: shutdown.signal }).catch((cause) => {
      if (!shutdown.signal.aborted) throw cause;
    });
  }
} finally {
  await db.close();
}
