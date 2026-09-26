import { resolve } from "node:path"

import { adapterFixture, checkConsumers } from "@rpc-vue/core/test-utils/nuxt-consumer"
import pkg from "trpc-vue/package.json"

const packageRoot = resolve(import.meta.dir, "../..")
const trpcVersion = pkg.devDependencies["@trpc/server"]

await checkConsumers({
  packageRoot,
  adapterRoots: [packageRoot],
  fixtures: [adapterFixture],
  dependencies: {
    "@trpc/client": trpcVersion,
    "@trpc/server": trpcVersion,
    superjson: pkg.devDependencies.superjson,
  },
})
