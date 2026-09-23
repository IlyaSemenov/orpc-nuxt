import { addImports, addPluginTemplate, createResolver, defineNuxtModule } from "@nuxt/kit"
import { uneval } from "devalue"

import type { StaticQueryClientConfig } from "./runtime/nuxt/query-config"

export type { ORPCRuntimeHooks as ModuleRuntimeHooks } from "./runtime/nuxt/hooks"
export type { StaticQueryClientConfig } from "./runtime/nuxt/query-config"

/** Configure the integration through the `orpc` section of nuxt.config. */
export interface ModuleOptions {
  /** Set static query defaults, or use false when another plugin owns Vue Query and hydration. */
  queryClient?: boolean | StaticQueryClientConfig
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: "orpc-nuxt",
    configKey: "orpc",
    compatibility: { nuxt: "^3.14.1592 || ^4.0.1" },
  },
  defaults: { queryClient: true },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    // Also bundle runtime entrypoints when the module is registered by function instead of name.
    nuxt.options.build.transpile.push("orpc-nuxt")
    // Keep the Vue Query integration out of prebundling alongside Nuxt's runtime plugins.
    const optimizeDeps = (nuxt.options.vite.optimizeDeps ??= {})
    optimizeDeps.exclude ??= []
    optimizeDeps.exclude.push("orpc-nuxt/client", "@tanstack/vue-query")
    const composables = resolver.resolve("./runtime/composables")
    addImports([
      { name: "useOrpc", from: composables },
      { name: "useOrpcQueryClient", from: composables },
    ])
    if (options.queryClient) {
      const config = options.queryClient === true ? {} : options.queryClient
      addPluginTemplate({
        filename: "orpc-nuxt/query-client.mjs",
        // Emit static defaults into both bundles; uneval preserves values such as Infinity.
        // Functions must use the runtime hook, where their closures are available.
        // Keep enforce in the generated object so Nuxt can read its order without executing it.
        getContents: () =>
          [
            `import { defineNuxtPlugin } from "nuxt/app"`,
            `import createQueryClientSetup from ${JSON.stringify(resolver.resolve("./runtime/nuxt/plugin"))}`,
            `export default defineNuxtPlugin({`,
            `  name: "orpc-nuxt:query-client",`,
            `  enforce: "pre",`,
            `  setup: createQueryClientSetup(${uneval(config)}),`,
            `})`,
          ].join("\n"),
      })
    }
  },
})
