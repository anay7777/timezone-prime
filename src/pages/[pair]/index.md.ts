import type { APIRoute, GetStaticPaths } from 'astro';
import { pairs, type Pair } from '../../data/pairs';
import { pairMarkdown } from '../../lib/geo';

export const getStaticPaths = (() => pairs.map((p) => ({ params: { pair: p.slug }, props: { pair: p } }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ pair: Pair }> = ({ props }) =>
  new Response(pairMarkdown(props.pair, Date.now()), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
