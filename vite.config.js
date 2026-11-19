import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// In `npm run dev`, serve the Vercel functions in /api from the Vite server
// too, so the Outlook flow runs locally. Server-only settings (MS_*) are read
// from .env.local and never exposed to the browser bundle (no VITE_ prefix).
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/outlook', async (req, res) => {
        const mod = await server.ssrLoadModule('/api/outlook.js');
        await mod.default(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return { plugins: [react(), devApi()] };
})
