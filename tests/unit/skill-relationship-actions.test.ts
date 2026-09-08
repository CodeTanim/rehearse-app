import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class RelationshipError extends Error {
    constructor(
      public readonly code: string,
      public readonly publicMessage: string,
    ) {
      super(publicMessage)
    }
  }

  return {
    auth: vi.fn(),
    connect: vi.fn(),
    updateStatus: vi.fn(),
    revalidatePath: vi.fn(),
    RelationshipError,
  }
})

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/learning/relationship-service", () => ({
  connectSkillRelationship: mocks.connect,
  updateSkillRelationshipStatus: mocks.updateStatus,
  SkillRelationshipError: mocks.RelationshipError,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import {
  connectSkillRelationshipAction,
  manageSkillRelationshipAction,
} from "@/app/actions/skill-relationships"

describe("skill relationship Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "session-user" } })
    mocks.connect.mockResolvedValue({ id: "relationship-a" })
    mocks.updateStatus.mockResolvedValue({ id: "relationship-a" })
  })

  it("uses only the authenticated owner when connecting leaves", async () => {
    const form = new FormData()
    form.set("sourceGoalSkillId", "goal-skill-a")
    form.set("targetGoalSkillId", "goal-skill-b")
    form.set("kind", "PREREQUISITE")
    form.set("userId", "untrusted-user")

    await expect(connectSkillRelationshipAction({}, form)).resolves.toEqual({})
    expect(mocks.connect).toHaveBeenCalledWith({
      userId: "session-user",
      sourceGoalSkillId: "goal-skill-a",
      targetGoalSkillId: "goal-skill-b",
      kind: "PREREQUISITE",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/skills")
  })

  it("returns a concise domain error for a cycle", async () => {
    mocks.connect.mockRejectedValue(
      new mocks.RelationshipError(
        "PREREQUISITE_CYCLE",
        "That prerequisite would create a loop.",
      ),
    )
    const form = new FormData()
    form.set("sourceGoalSkillId", "goal-skill-a")
    form.set("targetGoalSkillId", "goal-skill-b")
    form.set("kind", "PREREQUISITE")

    await expect(connectSkillRelationshipAction({}, form)).resolves.toEqual({
      error: "That prerequisite would create a loop.",
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("requires a session before mutating a suggestion", async () => {
    mocks.auth.mockResolvedValue(null)
    const form = new FormData()
    form.set("relationshipId", "relationship-a")
    form.set("intent", "ACCEPT")

    await expect(manageSkillRelationshipAction(form)).resolves.toEqual({ error: "Sign in to continue." })
    expect(mocks.updateStatus).not.toHaveBeenCalled()
  })

  it("returns removal errors instead of silently hiding a failed mutation", async () => {
    mocks.updateStatus.mockRejectedValue(new mocks.RelationshipError("INVALID_STATUS", "That connection has already changed."))
    const form = new FormData()
    form.set("relationshipId", "relationship-a")
    form.set("intent", "REMOVE")
    await expect(manageSkillRelationshipAction(form)).resolves.toEqual({ error: "That connection has already changed." })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it.each(["ACCEPT", "DISMISS", "REMOVE"] as const)(
    "owner-scopes the %s relationship action",
    async (intent) => {
      const form = new FormData()
      form.set("relationshipId", "relationship-a")
      form.set("intent", intent)

      await manageSkillRelationshipAction(form)

      expect(mocks.updateStatus).toHaveBeenCalledWith({
        userId: "session-user",
        relationshipId: "relationship-a",
        action: intent,
      })
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/skills")
    },
  )
})
