import { readFile } from "node:fs/promises"
import { dirname, extname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "vitest"

const projectRoot = fileURLToPath(new URL("../..", import.meta.url))
const testingEntry = resolve(projectRoot, "src/runtime/testing.ts")

test("keeps the testing entry's package import graph free of Nuxt runtime imports", async () => {
  // Scan source so the regular test command does not depend on a preceding package build.
  const pending = [testingEntry]
  const visited = new Set<string>()

  while (pending.length > 0) {
    const file = pending.pop()!
    if (visited.has(file)) continue
    visited.add(file)

    const source = await readFile(file, "utf8")
    const imports = [...source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)].map(
      (match) => match[1]!,
    )
    const nuxtRuntimeImport = imports.find(
      (specifier) =>
        specifier === "nuxt/app" ||
        specifier.startsWith("nuxt/app/") ||
        specifier.startsWith("#app") ||
        specifier === "#imports",
    )
    expect(nuxtRuntimeImport, file).toBeUndefined()

    for (const specifier of imports) {
      const imported = resolvePackageImport(file, specifier)
      if (imported) pending.push(imported)
    }
  }
})

/** Resolve imports owned by this package while leaving external dependencies outside its graph. */
function resolvePackageImport(importer: string, specifier: string) {
  let imported: string
  if (specifier.startsWith(".")) {
    imported = resolve(dirname(importer), specifier)
  } else if (specifier.startsWith("orpc-nuxt/")) {
    imported = resolve(projectRoot, "src/runtime", specifier.slice("orpc-nuxt/".length))
  } else if (specifier === "orpc-nuxt") {
    imported = resolve(projectRoot, "src/module")
  } else {
    return undefined
  }
  return extname(imported) ? imported : `${imported}.ts`
}
