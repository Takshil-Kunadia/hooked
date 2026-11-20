import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const isCI = Boolean(process.env.CI);

/** Locally we drive the installed Chrome; CI installs Playwright's Chromium. */
const chrome = isCI ? {} : { channel: "chrome" as const };
const webgl = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] };

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  /* SwiftShader renders in software on the CPU: more than two browsers at once starve each other's frames */
  workers: 2,
  timeout: 60_000,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? "github" : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...chrome, launchOptions: webgl } },
    { name: "phone", use: { ...devices["Pixel 7"], ...chrome, launchOptions: webgl } },
  ],
});
