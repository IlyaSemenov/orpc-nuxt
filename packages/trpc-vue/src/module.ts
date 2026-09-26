import { defineRpcNuxtModule } from "@rpc-vue/core/nuxt/module"

export type { ModuleOptions } from "@rpc-vue/core/nuxt/module"
export type { StaticQueryClientConfig } from "@rpc-vue/core/nuxt/query-config"
export type { TRPCRuntimeHooks as ModuleRuntimeHooks } from "./runtime/nuxt/hooks"

export default defineRpcNuxtModule({
  name: "trpc-vue",
  configKey: "trpc",
  composables: ["useTrpc", "useTrpcQueryClient"],
  moduleUrl: import.meta.url,
})
