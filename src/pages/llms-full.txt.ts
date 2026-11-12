import type { APIRoute } from 'astro';
import { llmsFull } from '../lib/geo';

export const GET: APIRoute = () =>
  new Response(llmsFull(Date.now()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
