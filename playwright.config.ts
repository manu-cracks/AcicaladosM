import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3100', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 3100 --host 127.0.0.1', url: 'http://127.0.0.1:3100', reuseExistingServer: false,
    env: { VITE_SUPABASE_URL:'http://127.0.0.1:54399', VITE_SUPABASE_ANON_KEY:'qa-public-fixture', VITE_YAPE_PHONE:'999999999', VITE_YAPE_QR_URL:'/LogoAcicalados.svg' } },
});
