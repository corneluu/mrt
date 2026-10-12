import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://corneluu.github.io',
  base: '/mrt',
  integrations: [sitemap()],
  image: {
    domains: [],
  },
  build: {
    format: 'directory',
  },
});
