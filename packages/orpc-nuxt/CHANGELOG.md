# orpc-nuxt

## 0.5.0

### Minor Changes

- bdb765f: Add typed handling of declared procedure errors and a test helper for creating them.

## 0.4.0

### Minor Changes

- 452be12: Allow the Nuxt plugin helper to create a custom oRPC link with access to the current SSR request event.

## 0.3.1

### Patch Changes

- 7a62794: `createTestORPCClient()` now owns a QueryClient that never retries, exposes it as `queryClient`, and clears it from `reset()`.

## 0.3.0

### Minor Changes

- b83340d: Add the `orpc-nuxt/testing` entrypoint with `createTestORPCClient()`, which creates a fake oRPC client whose procedures register typed handlers and return Vitest mocks.

## 0.2.0

### Minor Changes

- 5b3908a: Add the auto-imported `useOrpcQueryClient()`, which returns the app's QueryClient and also works outside Vue components.
- aa9d708: Accept later oRPC 2.0.0 betas: `@orpc/client` and `@orpc/tanstack-query` now allow `^2.0.0-beta.35` instead of that exact version.

## 0.1.1

### Patch Changes

- ac187ab: Support Nuxt 3.14 and later, and accept the `@nuxt/kit` and `devalue` versions that the host Nuxt installs.

## 0.1.0

### Minor Changes

- 47bb193: Add oRPC v2 integration for Nuxt 3 and 4 with a typed HTTP plugin helper, reactive, awaitable queries, mutations, SSR hydration, and configurable caching.
  Support local mutable clones, readonly selections, and invalidation of procedures or router branches.
