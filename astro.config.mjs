import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mrt.ro',
  integrations: [sitemap()],
  image: {
    domains: [],
  },
  build: {
    format: 'directory',
  },
});
