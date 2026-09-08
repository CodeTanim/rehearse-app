import { expect, test } from "@playwright/test"

const DEMO_EMAIL = "demo@rehearse.local"
const DEMO_PASSWORD = "RehearseDemo!2026"

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/auth/login")
  await page.getByLabel("Email address").fill(DEMO_EMAIL)
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/today$/, { timeout: 15_000 })
  await page.goto("/library")
  await expect(page).toHaveURL(/\/library$/)
}

test.describe("authenticated organizer smoke flow", () => {
  // These tests intentionally share one deterministic local account and SQLite
  // database. Serial execution keeps the smoke harness isolated from its own
  // process-local login throttle while still exercising real browser requests.
  test.describe.configure({ mode: "serial" })

  test("opens a seeded folder through durable URL state and switches material tabs", async ({ page }) => {
    await signIn(page)

    await expect(
      page.getByRole("heading", { name: "Library" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Open", exact: true }).click()

    await expect(page).toHaveURL(/\/library\?folder=local-demo-folder$/)
    await expect(page.getByRole("heading", { level: 1, name: "System Design Foundations" })).toBeVisible()

    const notesTab = page.getByRole("tab", { name: /Notes/ })
    await notesTab.click()
    await expect(notesTab).toHaveAttribute("aria-selected", "true")
    await expect(page.getByRole("searchbox", { name: "Search notes" })).toBeVisible()

    await page.reload()
    await expect(page).toHaveURL(/\/library\?folder=local-demo-folder$/)
    await expect(page.getByRole("heading", { level: 1, name: "System Design Foundations" })).toBeVisible()
    await expect(page.getByText("Test files only. No private content.")).toBeVisible()
  })

  test("moves focus into and back out of the create-folder dialog", async ({ page }) => {
    await signIn(page)

    const trigger = page.getByRole("button", { name: "New folder" })
    await trigger.click()

    const dialog = page.getByRole("dialog", { name: "New folder" })
    await expect(dialog).toBeVisible()
    await expect(page.getByLabel("Name", { exact: true })).toBeFocused()

    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test("validates note input and protects unsaved work while restoring focus", async ({ page }) => {
    await signIn(page)
    await page.getByRole("button", { name: "Open", exact: true }).click()
    await page.getByRole("tab", { name: /Notes/ }).click()

    const trigger = page.getByRole("button", { name: "New note" })
    await trigger.click()

    const save = page.getByRole("button", { name: "Save", exact: true })
    await expect(page.getByLabel("Title", { exact: true })).toBeFocused()
    await expect(save).toBeDisabled()

    await page.getByLabel("Title", { exact: true }).fill("Unsaved focus check")
    await page.getByLabel("Note", { exact: true }).fill("This synthetic note is discarded before the test ends.")
    await expect(save).toBeEnabled()

    await page.keyboard.press("Escape")
    await expect(page.getByRole("alertdialog", { name: "Discard unsaved changes?" })).toBeVisible()
    await page.getByRole("button", { name: "Discard changes" }).click()

    await expect(page.getByRole("heading", { name: "New note" })).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test("uploads, previews, and deletes a supported file through the browser", async ({ page }) => {
    await signIn(page)
    await page.getByRole("button", { name: "Open", exact: true }).click()

    const fileName = `browser-smoke-${crypto.randomUUID()}.txt`
    await page.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from("Synthetic browser smoke-test material."),
    })

    const fileTrigger = page.getByRole("button", { name: `Open ${fileName}` })
    await expect(fileTrigger).toBeVisible()
    await fileTrigger.click()

    const viewer = page.getByRole("dialog", { name: fileName })
    await expect(viewer).toBeVisible()
    await expect(page.getByRole("button", { name: `Download ${fileName}` })).toBeVisible()
    await page.getByRole("button", { name: `Close ${fileName} viewer` }).click()
    await expect(fileTrigger).toBeFocused()

    await page.getByRole("button", { name: `Delete ${fileName}` }).click()
    await expect(page.getByRole("alertdialog", { name: `Delete “${fileName}”?` })).toBeVisible()
    const deleteResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "DELETE" &&
      response.url().includes("/api/skill-folders/local-demo-folder/files/"),
    )
    await page.getByRole("button", { name: "Delete file" }).click()
    const deleteResponse = await deleteResponsePromise
    expect(deleteResponse.ok()).toBe(true)
    await expect(fileTrigger).toBeHidden()
  })
})
