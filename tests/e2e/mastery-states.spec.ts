import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { expect, test } from "@playwright/test"

const execFileAsync = promisify(execFile)
const DEMO_EMAIL = "demo@rehearse.local"
const DEMO_PASSWORD = "RehearseDemo!2026"

async function setDemoState(state: "well-learned" | "refresh-due" | "lapse") {
  await execFileAsync(process.execPath, ["scripts/set-demo-state.mjs", state], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: "file:./dev.local.db",
    },
  })
}

test("shows Well learned, Refresh due, and a lapse from real evidence", async ({ page }) => {
  test.setTimeout(120_000)

  await page.goto("/auth/login")
  await page.getByLabel("Email address").fill(DEMO_EMAIL)
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/today$/, { timeout: 15_000 })

  try {
    await setDemoState("well-learned")
    await page.reload()
    await page.locator("summary").filter({ hasText: "View in tree" }).click()
    await expect(page.getByText("Well learned", { exact: true })).toBeVisible()
    await expect(page.getByLabel(/Well learned, Current, high confidence/)).toBeVisible()

    await setDemoState("refresh-due")
    await page.reload()
    await expect(page.getByText("Refresh due", { exact: true }).first()).toBeVisible()
    await page.locator("summary").filter({ hasText: "View in tree" }).click()
    await expect(page.getByLabel(/Well learned, Refresh due, high confidence/)).toBeVisible()

    await setDemoState("lapse")
    await page.reload()
    await page.locator("summary").filter({ hasText: "View in tree" }).click()
    await expect(page.getByText("Learning", { exact: true })).toBeVisible()
    await page.locator("summary").filter({ hasText: "Details" }).click()
    await expect(
      page.getByText(/Latest recall missed · refresh scheduled$/),
    ).toBeVisible()
  } finally {
    await setDemoState("refresh-due")
  }
})
