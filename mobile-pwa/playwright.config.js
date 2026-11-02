import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    workers: 1,
    use: {
        baseURL: 'http://127.0.0.1:4312',
        launchOptions: process.env.NEXUS_BROWSER_PATH
            ? { executablePath: process.env.NEXUS_BROWSER_PATH }
            : {},
        screenshot: 'only-on-failure'
    },
    webServer: [
        {
            command: 'node ../backend/scripts/nexus-fixture-server.js',
            url: 'http://127.0.0.1:4311/api/health',
            env: { NODE_ENV: 'test' },
            reuseExistingServer: false
        },
        {
            command: 'npm run dev -- --host 127.0.0.1 --port 4312',
            url: 'http://127.0.0.1:4312',
            env: { VITE_API_URL: 'http://127.0.0.1:4311' },
            reuseExistingServer: false
        }
    ]
});
