import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  completeRemediation: vi.fn(),
  revalidatePath: vi.fn(),
  LearningGapNotFoundError: class LearningGapNotFoundError extends Error {},
  StaleRemediationRevisionError: class StaleRemediationRevisionError extends Error {
    readonly code = "STALE_REMEDIATION_REVISION"
  },
}))

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/learning/remediation-service", () => ({
  completeRemediation: mocks.completeRemediation,
  LearningGapNotFoundError: mocks.LearningGapNotFoundError,
  STALE_REMEDIATION_REVISION_CODE: "STALE_REMEDIATION_REVISION",
  StaleRemediationRevisionError: mocks.StaleRemediationRevisionError,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import { completeRemediationAction } from "@/app/actions/remediation"

describe("remediation Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "session-user" } })
    mocks.completeRemediation.mockResolvedValue({
      gapId: "gap-a",
      remediationRevisionId: "revision-a",
      completedAt: new Date("2026-09-06T12:00:00.000Z"),
      alreadyCompleted: false,
    })
  })

  it("requires authentication before recording assisted practice", async () => {
    mocks.auth.mockResolvedValue(null)
    const form = new FormData()
    form.set("goalSkillId", "goal-skill-a")
    form.set("gapId", "gap-a")
    form.set("remediationRevisionId", "revision-a")
    form.set("answer", "My explanation")

    await expect(completeRemediationAction({}, form)).resolves.toEqual({
      error: "Sign in to continue.",
    })
    expect(mocks.completeRemediation).not.toHaveBeenCalled()
  })

  it("uses the session owner and revalidates the learning surfaces", async () => {
    const form = new FormData()
    form.set("goalSkillId", " goal-skill-a ")
    form.set("gapId", " gap-a ")
    form.set("remediationRevisionId", " revision-a ")
    form.set("answer", " Retrieval checks memory. ")
    form.set("userId", "untrusted-user")

    await expect(completeRemediationAction({}, form)).resolves.toEqual({
      completed: true,
    })
    expect(mocks.completeRemediation).toHaveBeenCalledWith({
      userId: "session-user",
      goalSkillId: "goal-skill-a",
      gapId: "gap-a",
      remediationRevisionId: "revision-a",
      answer: "Retrieval checks memory.",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/skills/goal-skill-a/strengthen/gap-a",
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/today")
  })

  it("rejects an empty scaffold response before calling the service", async () => {
    const form = new FormData()
    form.set("goalSkillId", "goal-skill-a")
    form.set("gapId", "gap-a")
    form.set("remediationRevisionId", "revision-a")
    form.set("answer", "   ")

    await expect(completeRemediationAction({}, form)).resolves.toEqual({
      error: "Write an answer before finishing.",
    })
    expect(mocks.completeRemediation).not.toHaveBeenCalled()
  })

  it("returns a stable reload response for a stale displayed revision", async () => {
    mocks.completeRemediation.mockRejectedValue(
      new mocks.StaleRemediationRevisionError(
        "This practice changed. Reload to continue.",
      ),
    )
    const form = new FormData()
    form.set("goalSkillId", "goal-skill-a")
    form.set("gapId", "gap-a")
    form.set("remediationRevisionId", "revision-a")
    form.set("answer", "My answer to the displayed revision.")

    await expect(completeRemediationAction({}, form)).resolves.toEqual({
      error: "This practice changed. Reload to continue.",
      errorCode: "STALE_REMEDIATION_REVISION",
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})
