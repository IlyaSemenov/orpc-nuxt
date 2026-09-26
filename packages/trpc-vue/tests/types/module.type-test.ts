import type { ModuleOptions } from "trpc-vue/nuxt/module"

const options: ModuleOptions = {
  queryClient: {
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false },
      mutations: { retry: 2 },
    },
  },
}

const runtimeOnly: ModuleOptions = {
  queryClient: {
    defaultOptions: {
      queries: {
        // @ts-expect-error Runtime functions must use the trpc:query-client hook.
        retry: () => false,
      },
    },
  },
}

void options
void runtimeOnly
