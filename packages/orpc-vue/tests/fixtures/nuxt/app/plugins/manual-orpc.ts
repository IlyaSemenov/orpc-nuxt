import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import { createORPCVueQuery } from "orpc-vue"

import type { router } from "../../server/utils/router"

/** Exercise the client entrypoint alongside the helper under Vite dependency optimization. */
export default defineNuxtPlugin(() => {
  const link = new RPCLink({
    origin: useRequestURL().origin,
    url: "/rpc",
  })
  const client = createORPCClient<RouterClient<typeof router>>(link)
  const manualOrpc = createORPCVueQuery(client)
  return {
    provide: { manualOrpc },
  }
})
