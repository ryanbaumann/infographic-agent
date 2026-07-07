import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  server: {
    port: 3456,
    strictPort: true,
  },
  plugins: [
    react(),
    viteSingleFile(),
    {
      // The app entry is app.html; serve it at "/" in dev so the dev server
      // matches production (where the built file is dist/index.html).
      name: 'serve-app-html-at-root',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            req.url = '/app.html';
          }
          next();
        });
      },
    },
    {
      name: 'rename-index-html',
      enforce: 'post',
      generateBundle(_, bundle) {
        if (bundle['app.html']) {
          bundle['app.html'].fileName = 'index.html';
        }
      }
    }
  ],
  base: './',
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'app.html',
    },
  },
})
