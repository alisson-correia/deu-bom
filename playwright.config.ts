import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4180', serviceWorkers: 'block', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180', reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: 'https://supabase.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'small-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 700 }, hasTouch: true } },
  ],
});
