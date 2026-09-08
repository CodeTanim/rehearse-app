import { expect, test } from "@playwright/test"

test.describe("public and authentication smoke flow", () => {
  test("landing page is truthful, responsive, and links to authentication", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto("/")

    await expect(page).toHaveTitle("Rehearse — Build skills you can prove")
    await expect(
      page.getByRole("heading", { name: "Build skills you can prove." }),
    ).toBeVisible()
    await expect(page.getByText("Use test data only.")).toBeVisible()
    await expect(page.getByText("Product direction", { exact: true })).toBeVisible()
    await expect(page.getByText("One-leaf practice is live. Connected branches are next.")).toBeVisible()
    await expect(page.getByText("Well learned", { exact: true }).first()).toBeVisible()

    const pageOverflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(pageOverflows).toBe(false)

    const signInLink = page.getByRole("link", { name: "Sign in" }).first()
    await expect(signInLink).toHaveAttribute("href", "/auth/login")
    await Promise.all([
      page.waitForURL(/\/auth\/login$/, { timeout: 15_000 }),
      signInLink.click(),
    ])
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
  })

  test("protected routes preserve a safe return destination", async ({ page }) => {
    await page.goto("/dashboard?focus=test")

    await expect(page).toHaveURL(
      /\/auth\/login\?returnTo=%2Fdashboard%3Ffocus%3Dtest$/,
    )
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
  })

  test("login validates empty credentials without a network request", async ({ page }) => {
    await page.goto("/auth/login")
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(
      page.getByText("Enter your email and password.", { exact: true }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/login$/)
  })

  test("password recovery states its current limitation honestly", async ({ page }) => {
    await page.goto("/auth/reset-password")

    await expect(
      page.getByRole("heading", { name: "Password recovery isn’t available yet" }),
    ).toBeVisible()
    await expect(page.getByText("No reset email will be sent.", { exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "Back to sign in" })).toBeVisible()
    await expect(page.getByRole("textbox")).toHaveCount(0)
  })

  test("registration exposes labelled fields and password requirements", async ({ page }) => {
    await page.goto("/auth/register")

    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible()
    await expect(page.getByLabel("Name", { exact: true })).toBeVisible()
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible()
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible()
    await expect(page.getByText(/12.*128 characters/)).toBeVisible()
  })
})
