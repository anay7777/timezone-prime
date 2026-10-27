import type { APIRoute } from 'astro';
import { pairs } from '../data/pairs';
import { pairSeo } from '../lib/seo';

interface Entry {
  path: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: number;
}

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://timezoneprime.com');
  const lastmod = new Date().toISOString().slice(0, 10);
  const entries: Entry[] = [
    { path: '/', changefreq: 'weekly', priority: 1 },
    { path: '/faq/', changefreq: 'monthly', priority: 0.7 },
    { path: '/widgets/', changefreq: 'monthly', priority: 0.6 },
    { path: '/about/', changefreq: 'monthly', priority: 0.5 },
    { path: '/contact/', changefreq: 'monthly', priority: 0.4 },
    { path: '/privacy-policy/', changefreq: 'monthly', priority: 0.3 },
    { path: '/terms-and-conditions/', changefreq: 'monthly', priority: 0.3 },
    ...pairs.map((p): Entry => ({ path: `/${p.slug}/`, changefreq: 'monthly', priority: pairSeo(p.slug) ? 0.9 : 0.8 })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${new URL(e.path, base).href}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
