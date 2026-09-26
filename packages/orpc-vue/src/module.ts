import { defineRpcNuxtModule } from "@rpc-vue/core/nuxt/module"

export type { ModuleOptions } from "@rpc-vue/core/nuxt/module"
export type { StaticQueryClientConfig } from "@rpc-vue/core/nuxt/query-config"
export type { ORPCRuntimeHooks as ModuleRuntimeHooks } from "./runtime/nuxt/hooks"

export default defineRpcNuxtModule({
  name: "orpc-vue",
  configKey: "orpc",
  composables: ["useOrpc", "useOrpcQueryClient"],
  moduleUrl: import.meta.url,
})
