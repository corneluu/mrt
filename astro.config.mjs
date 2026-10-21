import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://corneluu.github.io',
  base: '/mrt',
  // The admin page (random path under /p-...) must never appear in the sitemap.
  integrations: [sitemap({ filter: (page) => !/\/p-[0-9a-f]{16}\//.test(page) })],
  image: {
    domains: [],
  },
  build: {
    format: 'directory',
  },
});
