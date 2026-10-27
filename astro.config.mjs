// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

/**
 * With `trailingSlash: 'always'` the dev server answers `/faq` with Astro's built-in
 * 404 instead of redirecting, so add the slash before Astro sees the request.
 * Astro unshifts its own handler in a post `configureServer` hook, so this plugin must be
 * `enforce: 'post'` and unshift from its post hook to end up ahead of it.
 * @returns {import('vite').Plugin}
 */
function devTrailingSlashRedirect() {
  return {
    name: 'dev-trailing-slash-redirect',
    apply: 'serve',
    enforce: 'post',
    configureServer(server) {
      /** @type {import('vite').Connect.NextHandleFunction} */
      const redirect = (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const { pathname } = url;
        const isAsset = /\.[^/]+$/.test(pathname) || /^\/(@|_|node_modules\/|src\/)/.test(pathname);
        if ((req.method !== 'GET' && req.method !== 'HEAD') || pathname.endsWith('/') || isAsset) {
          return next();
        }
        res.statusCode = 301;
        res.setHeader('Location', `${pathname}/${url.search}`);
        res.end();
      };
      return () => {
        server.middlewares.stack.unshift({ route: '', handle: redirect });
      };
    },
  };
}

export default defineConfig({
  site: 'https://timezoneprime.com',
  trailingSlash: 'always',
  output: 'static',
  compressHTML: true,

  devToolbar: {
    enabled: false,
  },

  build: {
    format: 'directory',
  },

  vite: {
    plugins: [tailwindcss(), devTrailingSlashRedirect()],
  },

  integrations: [sitemap()],
});