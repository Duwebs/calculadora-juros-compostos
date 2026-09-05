// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: "https://calculadora-juros-compostos-ai.vercel.app",
  integrations: [
    sitemap({
      // Custom 404 page shouldn't appear in the sitemap.
      filter: (page) => !page.includes('/404'),
      // Set per-page priority / changefreq for better crawl prioritization.
      serialize: (item) => {
        const url = typeof item === 'string' ? item : item.url;
        const { pathname } = new URL(url);
        let priority = 0.8;
        let changefreq = "weekly";
        if (pathname === "/" || pathname === "") {
          priority = 1.0;
          changefreq = "weekly";
        } else if (pathname === "/sobre/" || pathname === "/contato/") {
          priority = 0.8;
          changefreq = "weekly";
        } else if (pathname === "/privacidade/" || pathname === "/termos/") {
          priority = 0.7;
          changefreq = "monthly";
        }
        return { ...item, priority, changefreq };
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
