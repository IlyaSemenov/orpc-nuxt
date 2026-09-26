import { defineConfig } from "@playwright/test"

/** Run an adapter's browser tests in tests/nuxt/ against the consumer server that test:nuxt starts. */
export default defineConfig({
  testDir: "tests/nuxt",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.RPC_TEST_URL,
    headless: true,
    // These tests only drive pages and requests, so the headless shell is enough and is the smallest download.
    channel: "chromium-headless-shell",
  },
})
