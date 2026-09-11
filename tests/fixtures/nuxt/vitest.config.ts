import { fileURLToPath } from "node:url"

import { defineVitestConfig } from "@nuxt/test-utils/config"

// Run the documented setup: tests under test/nuxt/ get this fixture's Nuxt environment.
export default defineVitestConfig({
  test: {
    environmentOptions: {
      // Load the fixture itself, whichever directory the test run starts from.
      nuxt: { rootDir: fileURLToPath(new URL(".", import.meta.url)) },
    },
  },
})
