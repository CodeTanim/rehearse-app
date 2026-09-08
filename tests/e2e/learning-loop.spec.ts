import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { expect, test } from "@playwright/test"

const execFileAsync = promisify(execFile)

test("creates a topic, grounds a mixed quiz, and adds the Skill Leaf", async ({ page }) => {
  test.setTimeout(120_000)

  const suffix = crypto.randomUUID()
  const email = `learner-${suffix}@rehearse.local`
  const password = "RehearseTest!2026"
  const topic = `Hashmaps ${suffix.slice(0, 6)}`

  await page.goto("/auth/register")
  await page.getByLabel("Name", { exact: true }).fill("Test Learner")
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Create account" }).click()

  await expect(page).toHaveURL(/\/auth\/login\?registered=1$/, { timeout: 15_000 })
  await page.getByLabel("Email address").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page).toHaveURL(/\/today$/, { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: "What will you learn?" })).toBeVisible()
  await page.getByRole("link", { name: "Get started" }).click()

  await expect(page.getByRole("heading", { name: "What do you want to learn?" })).toBeVisible()
  await page.getByLabel("Topic", { exact: true }).fill(topic)
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page).toHaveURL(/\/skills\/[^/]+\/sources$/)
  await expect(page.getByRole("heading", { name: "Add sources" })).toBeVisible()
  await page.getByLabel("Source", { exact: true }).selectOption("TEXT")
  await page.getByLabel("Name").fill("Hash map notes")
  await page
    .getByLabel("Text", { exact: true })
    .fill(
      "A hash map stores key-value pairs. A hash function maps a key to a bucket. Collisions happen when two keys map to the same bucket.",
    )
  await page.getByRole("button", { name: "Add source" }).click()

  await expect(page.getByText("Hash map notes", { exact: true })).toBeVisible()
  await expect(page.getByText("Ready", { exact: true })).toBeVisible()
  await page.getByLabel("Use these sources to generate my quiz.").check()
  await page.getByRole("button", { name: "Generate quiz" }).click()

  await expect(page).toHaveURL(/\/skills\/[^/]+\/quiz$/)
  await expect(page.getByText("Local preview", { exact: true })).toBeVisible()
  await page.locator("summary").filter({ hasText: "What this covers" }).click()
  await expect(page.getByText("Core idea", { exact: true })).toBeVisible()
  await expect(page.getByText("Data Structures", { exact: true })).toHaveCount(0)
  await expect(page.getByText(/stay hidden until a later recall/)).toBeVisible()
  await page.getByRole("link", { name: "Start quiz" }).click()

  await expect(page.getByText("1 / 4", { exact: true })).toBeVisible()
  await expect(page.getByText(/new-angle/i)).toHaveCount(0)
  expect(await page.content()).not.toContain("How could the core idea guide a new, realistic example?")
  await page.getByRole("radio").first().check()
  await page.getByRole("button", { name: "Check answer" }).click()
  await expect(page.getByRole("heading", { name: "Correct" })).toBeVisible()
  await page.getByRole("button", { name: "Next", exact: true }).click()

  await page.getByLabel("Your answer").fill("It maps stored keys to their values.")
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText("2 / 4", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Your answer")).toHaveValue("It maps stored keys to their values.")
  await page.getByRole("button", { name: "Compare answer" }).click()
  await page.getByLabel("Meets").check()
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel("Meets")).toBeChecked()
  await page.getByRole("button", { name: "Next", exact: true }).click()

  await page.getByRole("radio").nth(1).check()
  await page.getByRole("button", { name: "Check answer" }).click()
  await expect(page.getByRole("heading", { name: "Missed" })).toBeVisible()
  await page.getByRole("button", { name: "Review source" }).click()
  await expect(page.locator("blockquote")).toBeVisible()
  await page.getByRole("button", { name: "Next", exact: true }).click()

  await page.getByLabel("Your answer").fill("It determines where a lookup begins.")
  await page.getByRole("button", { name: "Compare answer" }).click()
  await page.getByLabel("Meets").check()
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith("/attempts"),
  )
  await page.getByRole("button", { name: "Finish quiz" }).click()
  expect((await saved).ok()).toBe(true)

  await expect(page.getByRole("heading", { name: "Quiz saved" })).toBeVisible()
  await expect(page.getByText("3 of 4 met.", { exact: false })).toBeVisible()
  await page.getByRole("link", { name: "Done" }).click()

  await page.getByRole("link", { name: "Progress", exact: true }).click()
  await expect(page.getByRole("heading", { name: topic, exact: true })).toBeVisible()
  await expect(page.getByText("Your learning evidence will appear here.")).toHaveCount(0)
  await page.getByRole("link", { name: "Today", exact: true }).click()

  await expect(page).toHaveURL(/\/today$/)
  await expect(page.getByRole("heading", { name: "Supporting detail" })).toBeVisible()
  await page.getByRole("link", { name: "Strengthen", exact: true }).click()

  await expect(page).toHaveURL(/\/skills\/[^/]+\/strengthen\/[^/]+$/)
  await expect(page.getByRole("heading", { name: "Supporting detail" })).toBeVisible()
  await page.locator("summary").filter({ hasText: "Source" }).click()
  await expect(page.locator("blockquote")).toContainText("hash")
  await page.locator("textarea[name='answer']").fill(
    "The supporting detail explains how a hash function maps a key to a bucket.",
  )
  await page.getByRole("button", { name: "Finish practice" }).click()
  await expect(page.getByText(/does not raise mastery/i)).toBeVisible()
  await page.getByRole("link", { name: "Back to Today" }).click()

  await expect(page).toHaveURL(/\/today$/)
  await expect(page.getByRole("heading", { name: topic, level: 2 })).toBeVisible()
  await page.getByRole("link", { name: "Tree" }).click()
  await expect(page).toHaveURL(/\/skills$/)
  await expect(page.getByRole("button", { name: new RegExp(`^${topic}:`) })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Data Structures" })).toHaveCount(0)

  // One-node controls remain recoverable, and the mobile list establishes height.
  await page.getByRole("button", { name: "Zoom in", exact: true }).click()
  await expect(page.getByText("118%", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /Reset view/ }).click()
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.getByRole("button", { name: new RegExp(`^${topic}:`) })).toBeInViewport()
    expect(await page.locator(".constellation-stage").evaluate((stage) =>
      stage.getBoundingClientRect().height >= stage.querySelector(".constellation-node-list")!.getBoundingClientRect().height)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole("link", { name: "Open skill", exact: true }).click()
  await expect(page.getByRole("heading", { name: topic, exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Your learning", exact: true })).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 800 })

  await execFileAsync(process.execPath, ["scripts/set-recall-due.mjs", email, topic], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: "file:./dev.local.db" },
  })
  await page.goto("/today")
  await page.getByRole("button", { name: "Review", exact: true }).click()
  await expect(page.getByText(`${topic} · 1 of 5`, { exact: true })).toBeVisible()

  for (let position = 1; position <= 4; position += 1) {
    if ((await page.getByRole("radio").count()) > 0) {
      await page.getByRole("radio").first().check()
      await page.getByRole("button", { name: "Check answer" }).click()
      await expect(page.getByText("Correct", { exact: true }).first()).toBeVisible()
    } else {
      await page.getByLabel("Your answer").fill("A source-grounded recall answer.")
      await page.getByRole("button", { name: "Reveal answer" }).click()
    }
    await page.getByRole("button", { name: /Correct.*Normal effort/ }).click()
    if (position === 1) {
      await expect(page.getByText(/recovered a previously missed idea/i)).toBeVisible()
    }
    await page.getByRole("button", { name: "Next question" }).click()
    await expect(page.getByText(`${topic} · ${position + 1} of 5`, { exact: true })).toBeVisible()
  }

  await expect(page.getByText("New angle", { exact: true })).toBeVisible()

  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 320, height: 800 })
  await expect
    .poll(() =>
      page
        .getByTestId("app-shell")
        .evaluate((element) => element.scrollWidth > element.clientWidth),
    )
    .toBe(false)
})
