import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      // Use an installed Chrome if CHROME_PATH is set; otherwise Playwright's own.
      executablePath: process.env.CHROME_PATH || undefined,
      args: [
        '--no-sandbox',
        // Fake camera/mic/screen so screen sharing can be tested without a person clicking the picker.
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--auto-select-desktop-capture-source=Entire screen',
      ],
    },
  },
});
