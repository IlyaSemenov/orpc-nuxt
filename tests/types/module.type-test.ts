import type { ModuleOptions } from "../../src/module"

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
        // @ts-expect-error Runtime functions must use the orpc:query-client hook.
        retry: () => false,
      },
    },
  },
}

void options
void runtimeOnly
