/** Native Hono entry point detected by Vercel; does not open a listening port. */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { mosaicFetch } from './dist/vercel.js';

const app = new Hono();
app.use('*', cors({ origin: process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean) ?? [] }));
app.all('*', (context) => mosaicFetch(context.req.raw));
export default app;
