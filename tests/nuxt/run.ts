import { cp, mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join, relative, resolve } from "node:path"

import nuxtPkg from "nuxt/package.json"

import pkg from "../../package.json"

const root = resolve(import.meta.dir, "../..")
const fixture = join(root, "tests/fixtures/nuxt")
// The consumer installs only the package's own dependencies, so component tests and build output stay behind.
const excludedFromConsumer = new Set([
  "node_modules",
  ".nuxt",
  ".nuxtrc",
  ".output",
  "test",
  "vitest.config.ts",
])
const workspace = await mkdtemp(join(tmpdir(), "orpc-nuxt-"))
const args = process.argv.slice(2)
const devOnly = args.includes("--dev")
// Versions are opt-in for manual compatibility checks.
const versions = args.filter((arg) => arg !== "--dev")
// Reproduce the exact Nuxt installed here, so the default run stays deterministic and matches the lockfile.
if (!versions.length) versions.push(nuxtPkg.version)

/** Run an isolated consumer's command without relying on the source workspace's dependencies. */
async function run(command: string[], cwd: string, env = process.env) {
  const process = Bun.spawn(command, { cwd, env, stdout: "inherit", stderr: "inherit" })
  if ((await process.exited) !== 0) throw new Error(`Command failed: ${command.join(" ")}`)
}

/** Ask the OS for an available port so local apps do not need to be stopped for the test. */
async function unusedPort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("No TCP port assigned")
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  return address.port
}

/** Run the same browser assertions against Vite dev and the production server. */
async function checkBrowser(
  app: string,
  env: NodeJS.ProcessEnv,
  mode: "development" | "production",
) {
  console.log(`Checking ${mode} server`)
  const port = await unusedPort()
  const baseURL = `http://127.0.0.1:${port}`
  const command =
    mode === "development"
      ? ["bun", "run", "nuxt", "dev", "--host", "127.0.0.1", "--port", String(port)]
      : ["node", ".output/server/index.mjs"]
  const server = Bun.spawn(command, {
    cwd: app,
    env: { ...env, HOST: "127.0.0.1", PORT: String(port) },
    stdout: "inherit",
    stderr: "inherit",
  })
  try {
    const deadline = Date.now() + 60_000
    while (true) {
      if (server.exitCode !== null) throw new Error("Nuxt server exited before becoming ready")
      try {
        const response = await fetch(baseURL)
        if (response.ok) break
      } catch {}
      if (Date.now() >= deadline) throw new Error("Nuxt server did not become ready")
      await Bun.sleep(100)
    }
    await run(["bun", "run", "playwright", "test"], root, {
      ...env,
      ORPC_TEST_URL: baseURL,
    })
  } finally {
    server.kill()
    await server.exited
  }
}

try {
  // Test the publishable archive, not file:directory, which can bring along the package's dev deps.
  const archive = join(workspace, "orpc-nuxt.tgz")
  await run(["bun", "pm", "pack", "--ignore-scripts", "--quiet", "--filename", archive], root)

  const scenarios = versions.flatMap((version) =>
    ["module", "custom"].map((owner) => ({ version, owner })),
  )
  for (const { version, owner } of scenarios) {
    console.log(`Checking Nuxt ${version} with ${owner} QueryClient`)
    const env = { ...process.env, ORPC_TEST_QUERY_CLIENT: owner }
    const app = join(workspace, `nuxt-${version}-${owner}`)
    await cp(fixture, app, {
      recursive: true,
      // Match inside the fixture only: the same names can appear in the directories above it.
      filter: (path) =>
        !relative(fixture, path)
          .split(/[\\/]/)
          .some((part) => excludedFromConsumer.has(part)),
    })
    await writeFile(
      join(app, "package.json"),
      JSON.stringify(
        {
          name: "orpc-nuxt-consumer",
          private: true,
          type: "module",
          dependencies: {
            "orpc-nuxt": `file:${archive}`,
            ...pkg.peerDependencies,
            nuxt: version,
            "@orpc/server": pkg.devDependencies["@orpc/server"],
            "@types/node": "^22.0.0",
            zod: pkg.devDependencies.zod,
            typescript: pkg.devDependencies.typescript,
            "vue-tsc": pkg.devDependencies["vue-tsc"],
          },
        },
        null,
        2,
      ),
    )
    if (version.startsWith("3.")) {
      await writeFile(
        join(app, "tsconfig.json"),
        JSON.stringify({ extends: "./.nuxt/tsconfig.json" }),
      )
    }
    await run(["bun", "install", "--ignore-scripts"], app)
    await run(["bun", "run", "nuxt", "typecheck"], app, env)
    if (!devOnly) {
      await run(["bun", "run", "nuxt", "build"], app, env)
      await checkBrowser(app, env, "production")
    }
    await checkBrowser(app, env, "development")
  }
} finally {
  await rm(workspace, { recursive: true, force: true })
}
