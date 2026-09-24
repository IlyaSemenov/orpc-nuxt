import type { Client } from "@orpc/client"

import { createORPCError, createTestORPCClient } from "../../src/runtime/testing"

type AppClient = {
  admin: {
    posts: {
      get: Client<
        { token: string },
        { id: number },
        { id: number; title: string },
        { code: "MISSING" }
      >
    }
  }
}

const { client, procedures } = createTestORPCClient<AppClient>()

procedures.admin.posts.get.handle(async (input) => {
  input.id satisfies number
  // @ts-expect-error The handler input retains the procedure input type.
  input.id satisfies string
  return { id: input.id, title: "Post" }
})
// @ts-expect-error The handler result must match the awaited procedure output.
procedures.admin.posts.get.handle(() => ({ id: 1, title: 2 }))
// @ts-expect-error Router branches are not procedure leaves.
procedures.admin.posts.handle(() => ({ id: 1, title: "Post" }))
// @ts-expect-error Unknown procedure paths must not be accepted.
procedures.admin.posts.missing.handle(() => ({ id: 1, title: "Post" }))

const query = client.admin.posts.get.useQuery({ id: 1 }, { context: { token: "secret" } })
query.error.value satisfies { code: "MISSING" } | null
// @ts-expect-error Client context remains required on the decorated fake client.
client.admin.posts.get.useQuery({ id: 1 })

const error = createORPCError("MISSING", "Missing post", { id: 1 })
error.code satisfies "MISSING"
error.data.id satisfies number
