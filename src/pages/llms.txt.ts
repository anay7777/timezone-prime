import type { APIRoute } from 'astro';
import { llmsIndex } from '../lib/geo';

export const GET: APIRoute = () =>
  new Response(llmsIndex(Date.now()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
