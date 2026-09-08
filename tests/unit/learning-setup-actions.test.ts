import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class NotFoundError extends Error {}
  class ConflictError extends Error {
    constructor(public readonly publicMessage: string) {
      super(publicMessage)
    }
  }

  return {
    auth: vi.fn(),
    createGoal: vi.fn(),
    createSkill: vi.fn(),
    createQuestionAndStart: vi.fn(),
    startReview: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
    NotFoundError,
    ConflictError,
  }
})

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/learning/setup-service", () => ({
  createActiveLearningGoal: mocks.createGoal,
  createSkillLeaf: mocks.createSkill,
  createManualQuestionAndStartSession: mocks.createQuestionAndStart,
  startOrResumePracticeSession: mocks.startReview,
  LearningSetupNotFoundError: mocks.NotFoundError,
  LearningSetupConflictError: mocks.ConflictError,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))

import {
  createGoalAction,
  createQuestionAndStartAction,
  createSkillAction,
  startReviewAction,
} from "@/app/actions/learning-setup"

describe("learning setup Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "user-from-session" } })
    mocks.createGoal.mockResolvedValue({ goalId: "goal-a" })
    mocks.createSkill.mockResolvedValue({ goalSkillId: "goal-skill-a" })
    mocks.createQuestionAndStart.mockResolvedValue({ sessionId: "session-a" })
    mocks.startReview.mockResolvedValue({ sessionId: "session-a" })
  })

  it("authenticates before a mutation and does not trust form identity", async () => {
    mocks.auth.mockResolvedValue(null)
    const form = new FormData()
    form.set("title", "Caching")
    form.set("outcome", "Design a cache")
    form.set("userId", "attacker-controlled")

    await expect(createGoalAction({}, form)).resolves.toEqual({
      error: "Sign in to continue.",
    })
    expect(mocks.createGoal).not.toHaveBeenCalled()
  })

  it("creates a goal for the session owner and advances to skill setup", async () => {
    const form = new FormData()
    form.set("title", " Caching ")
    form.set("outcome", " Design a cache. ")

    await createGoalAction({}, form)

    expect(mocks.createGoal).toHaveBeenCalledWith({
      userId: "user-from-session",
      title: " Caching ",
      outcome: " Design a cache. ",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/today")
    expect(mocks.redirect).toHaveBeenCalledWith("/goals/goal-a/setup/skill")
  })

  it("creates a scoped leaf and advances to recall setup", async () => {
    const form = new FormData()
    form.set("goalId", "goal-a")
    form.set("title", "Invalidation")
    form.set("outcome", "Choose a strategy")
    form.set("successCriterion", "Compare two approaches")

    await createSkillAction({}, form)

    expect(mocks.createSkill).toHaveBeenCalledWith({
      userId: "user-from-session",
      goalId: "goal-a",
      title: "Invalidation",
      outcome: "Choose a strategy",
      successCriterion: "Compare two approaches",
    })
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/goals/goal-a/skills/goal-skill-a/setup/question",
    )
  })

  it("creates the first recall and redirects to its durable practice session", async () => {
    const form = new FormData()
    form.set("goalSkillId", "goal-skill-a")
    form.set("prompt", "When is the cache stale?")
    form.set("referenceAnswer", "When its freshness contract expires.")

    await createQuestionAndStartAction({}, form)

    expect(mocks.createQuestionAndStart).toHaveBeenCalledWith({
      userId: "user-from-session",
      goalSkillId: "goal-skill-a",
      prompt: "When is the cache stale?",
      referenceAnswer: "When its freshness contract expires.",
    })
    expect(mocks.redirect).toHaveBeenCalledWith("/practice/session-a")
  })

  it("starts or resumes a review using only an owned goal-skill id", async () => {
    const form = new FormData()
    form.set("goalSkillId", "goal-skill-a")

    await startReviewAction({}, form)

    expect(mocks.startReview).toHaveBeenCalledWith({
      userId: "user-from-session",
      goalSkillId: "goal-skill-a",
    })
    expect(mocks.redirect).toHaveBeenCalledWith("/practice/session-a")
  })

  it("maps missing and cross-owner records to the same safe response", async () => {
    mocks.startReview.mockRejectedValue(new mocks.NotFoundError())
    const form = new FormData()
    form.set("goalSkillId", "not-owned")

    await expect(startReviewAction({}, form)).resolves.toEqual({
      error: "That learning item is unavailable.",
    })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
