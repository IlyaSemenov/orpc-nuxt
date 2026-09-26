# RPC Vue integration tests

Private workspace package for applications that use `orpc-vue` and `trpc-vue` together.
Neither adapter depends on this package or the other adapter.
Each adapter keeps its own tests, including installation of its archive without the other adapter.

The runtime tests check shared-cache isolation, hashing, invalidation and concurrent SSR requests against both adapters' source.
The Nuxt tests install both package archives into an isolated application and check types, SSR and browser hydration in development and production.
They cover oRPC-owned, tRPC-owned and application-owned caches, plus errors for duplicate or missing cache owners.
Both client plugins create their transports with custom link factories.

## Running

Install dependencies and build the public packages from the repository root:

```sh
bun install
bun run build
bunx playwright install chromium-headless-shell
```

From this directory, run:

```sh
bun run test
bun run types
bun run test:nuxt
```

`test:nuxt` uses the exact Nuxt version installed in the workspace.
Pass other versions explicitly when needed: `bun run test:nuxt 3.14.1592 4.0.1`.
Add `--dev` to skip the production build.
The package has no build or publish step.

The root workspace commands include these tests automatically.
