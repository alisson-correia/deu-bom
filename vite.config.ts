import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const hash = createHash('sha256');
for (const file of [...files(path.resolve('src')), 'index.html', 'package-lock.json']) hash.update(file.replace(process.cwd(), '')).update(readFileSync(file));
const appVersion = hash.digest('hex').slice(0, 16);
const versionBody = JSON.stringify({ version: appVersion });
const appVersionPlugin = {
  name: 'app-version',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: versionBody }); },
  configureServer(server) { server.middlewares.use('/version.json', (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(versionBody); }); },
};

export default defineConfig(({ mode }) => ({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    appVersionPlugin,
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.ico", "icon-192.png", "icon-512.png"],
      manifest: {
        id: "/",
        name: "Deu Bom Financas sem Erro",
        short_name: "Deu Bom",
        description: "Gerencie suas financas pessoais e eventos com experiencia de app.",
        theme_color: "#15131b",
        background_color: "#15131b",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        prefer_related_applications: false,
        categories: ["finance", "productivity", "business"],
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          charts: ["recharts"],
          supabase: ["@supabase/supabase-js"],
          ui: [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },
  },
}));
