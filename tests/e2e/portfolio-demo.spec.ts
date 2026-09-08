import { expect, test } from "@playwright/test"

test.describe("safe portfolio demo", () => {
  test.skip(
    process.env.PORTFOLIO_DEMO !== "1" && process.env.VERCEL !== "1",
    "Portfolio demo mode is not enabled.",
  )

  test("runs the synthetic refresh loop without auth or APIs", async ({ page, request }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto("/")

    await expect(page).toHaveURL(/\/demo$/)
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible()
    await expect(page.getByText("New angle due", { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false)

    await page.getByRole("button", { name: "Start", exact: true }).click()
    await expect(page.getByText("New angle", { exact: true })).toBeVisible()
    await page.getByLabel("Your answer").fill("Visible text or an ARIA label.")
    await page.getByRole("button", { name: "Reveal answer" }).click()

    const reference = page.getByLabel("Reference answer")
    await expect(reference).toBeVisible()
    await expect(reference).toBeFocused()
    await page.getByRole("button", { name: /Correct.*Normal effort/ }).click()

    await expect(page.getByText("Well learned", { exact: true })).toBeVisible()
    await expect(page.getByText("Correct · self-rated", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Done" }).click()
    await expect(page.getByText("Next in 30 days", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Tree", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Skill Tree" })).toBeVisible()
    await expect(page.getByText("Synthetic data · resets on refresh", { exact: true })).toBeVisible()

    const apiResponse = await request.get("/api/auth/session")
    expect(apiResponse.status()).toBe(404)

    await page.goto("/auth/login")
    await expect(page).toHaveURL(/\/demo$/)
  })
})
