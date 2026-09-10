import { expect, test } from "@playwright/test"

test("SSR isolates viewers and preserves Date results", async ({ request }) => {
  const responses = await Promise.all([
    request.get("/", {
      headers: {
        "x-viewer": "reader-ada",
        cookie: "session=ada",
        authorization: "must-not-be-forwarded",
      },
    }),
    request.get("/", {
      headers: { "x-viewer": "reader-grace", cookie: "session=grace" },
    }),
  ])
  const html = await Promise.all(responses.map((response) => response.text()))
  expect(responses.every((response) => response.ok())).toBe(true)
  expect(html[0]).toContain('<p id="viewer">reader-ada</p>')
  expect(html[0]).not.toContain("reader-grace")
  expect(html[1]).toContain('<p id="viewer">reader-grace</p>')
  expect(html[1]).not.toContain("reader-ada")
  expect(html[0]).toContain("2026-01-01T00:00:00.000Z")
  expect(html[0]).toContain('<p id="cookie">session=ada</p>')
  expect(html[0]).not.toContain("session=grace")
  expect(html[1]).toContain('<p id="cookie">session=grace</p>')
  expect(html[0]).not.toContain("must-not-be-forwarded")
  const transport = process.env.ORPC_TEST_QUERY_CLIENT === "custom" ? "server" : "shared"
  expect(html[0]).toContain(`<p id="transport">${transport}</p>`)
})

test("does not forward incoming headers unless explicitly listed", async ({ request }) => {
  const response = await request.get("/no-headers", {
    headers: { "x-viewer": "private-viewer", cookie: "session=private-cookie" },
  })
  expect(response.ok()).toBe(true)
  const html = await response.text()
  expect(html).toContain('<p id="viewer">visitor</p>')
  expect(html).not.toContain("private-viewer")
  expect(html).not.toContain("private-cookie")
})

test("invalidates the app cache from an event before any query or mutation is created", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/invalidation")
  await page.waitForLoadState("networkidle")
  await expect(page.locator("#invalidated")).toHaveText("false")
  await page.locator("#invalidate").click()
  await expect(page.locator("#invalidated")).toHaveText("true")
  expect(errors).toEqual([])
})

test("hydrates without refetching and keeps local edits separate from cache assignments", async ({
  page,
}) => {
  const errors: string[] = []
  const requests: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") errors.push(message.text())
  })
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/rpc/")) requests.push(request.url())
  })
  await page.setExtraHTTPHeaders({ "x-viewer": "browser" })
  await page.goto("/")
  await expect(page.locator("#hydrated")).toHaveText("true")
  await page.waitForLoadState("networkidle")
  expect(requests).toEqual([])
  await expect(page.locator("#viewer")).toHaveText("browser")
  await expect(page.locator("#manual-user")).toHaveText("Ada")
  await expect(page.locator("#date")).toHaveText("2026-01-01T00:00:00.000Z")
  await expect(page.locator("#defaults")).toHaveText("60000 / false")
  await expect(page.locator("#disabled")).toHaveText("idle")
  await page.locator("#edit").click()
  await expect(page.locator("#viewer")).toHaveText("local")
  await expect(page.locator("#selected")).toHaveText("browser")
  await page.locator("#share").click()
  await expect(page.locator("#viewer")).toHaveText("shared")
  await expect(page.locator("#selected")).toHaveText("shared")
  expect(errors).toEqual([])
})

test("reactive input, enabled, namespace invalidation and configured retry work in the browser", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { rpcCredentials: (RequestCredentials | undefined)[] }
    state.rpcCredentials = []
    // Preserve fetch's full API, including the extra properties in Bun's ambient types.
    window.fetch = new Proxy(window.fetch, {
      apply(target, receiver, args: [RequestInfo | URL, RequestInit?]) {
        const [input, init] = args
        if (String(input).includes("/rpc/")) state.rpcCredentials.push(init?.credentials)
        return Reflect.apply(target, receiver, args)
      },
    })
  })
  const requests: string[] = []
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (path.startsWith("/rpc/")) requests.push(path)
  })
  await page.goto("/")
  await expect(page.locator("#hydrated")).toHaveText("true")
  await expect(page.locator("#post")).toBeEmpty()
  await page.locator("#enable").click()
  await expect(page.locator("#post")).toHaveText("post 1")
  await page.locator("#next").click()
  await expect(page.locator("#post")).toHaveText("post 2")
  await page.locator("#invalidate").click()
  await expect.poll(() => requests.filter((path) => path.endsWith("/get")).length).toBe(3)
  await page.waitForLoadState("networkidle")
  await page.locator("#enable").click()
  await page.locator("#next").click()
  await page.waitForLoadState("networkidle")
  expect(requests.filter((path) => path.endsWith("/get"))).toHaveLength(3)
  await page.locator("#fail").click()
  await expect(page.locator("#error")).not.toBeEmpty()
  await page.waitForLoadState("networkidle")
  expect(requests.filter((path) => path.endsWith("/fail"))).toHaveLength(1)
  const credentials = await page.evaluate(() => {
    const state = window as typeof window & { rpcCredentials: (RequestCredentials | undefined)[] }
    return state.rpcCredentials
  })
  expect(credentials.length).toBeGreaterThan(0)
  expect(credentials.every((value) => value === "include")).toBe(true)
})
