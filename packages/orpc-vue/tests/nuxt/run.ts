import { resolve } from "node:path"

import { adapterFixture, checkConsumers } from "@rpc-vue/core/test-utils/nuxt-consumer"
import pkg from "orpc-vue/package.json"

const packageRoot = resolve(import.meta.dir, "../..")
// oRPC packages are released in lockstep, and the peer ranges also accept newer betas.
const orpcVersion = pkg.devDependencies["@orpc/server"]

await checkConsumers({
  packageRoot,
  adapterRoots: [packageRoot],
  fixtures: [adapterFixture],
  dependencies: {
    // Install the oRPC beta of this workspace, so the default run stays reproducible.
    "@orpc/client": orpcVersion,
    "@orpc/tanstack-query": orpcVersion,
    "@orpc/server": orpcVersion,
  },
})
