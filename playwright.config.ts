import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "tests/nuxt",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.ORPC_TEST_URL,
    headless: true,
  },
})
