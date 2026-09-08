import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const tx = {
    goalSkill: { findMany: vi.fn() },
    skillRelationship: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
  return { tx, transaction: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}))
vi.mock("server-only", () => ({}))

import {
  connectSkillRelationship,
  updateSkillRelationshipStatus,
  wouldCreatePrerequisiteCycle,
} from "@/lib/learning/relationship-service"

function ownedSkills() {
  return [
    { id: "goal-skill-a", skillNode: { id: "node-z", graphId: "graph-a" } },
    { id: "goal-skill-b", skillNode: { id: "node-a", graphId: "graph-a" } },
  ]
}

describe("skill relationship service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(
      async (work: (tx: typeof mocks.tx) => unknown) => work(mocks.tx),
    )
    mocks.tx.goalSkill.findMany.mockResolvedValue(ownedSkills())
    mocks.tx.skillRelationship.findMany.mockResolvedValue([])
    mocks.tx.skillRelationship.findUnique.mockResolvedValue(null)
    mocks.tx.skillRelationship.create.mockImplementation(async ({ data }) => ({
      id: "relationship-a",
      ...data,
    }))
    mocks.tx.skillRelationship.update.mockImplementation(async ({ data }) => ({
      id: "relationship-a",
      ...data,
    }))
  })

  it("creates an explicit Related connection as a confirmed user relationship", async () => {
    await connectSkillRelationship({
      userId: "user-a",
      sourceGoalSkillId: "goal-skill-a",
      targetGoalSkillId: "goal-skill-b",
      kind: "RELATED",
    })

    expect(mocks.tx.goalSkill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["goal-skill-a", "goal-skill-b"] },
          userId: "user-a",
        }),
      }),
    )
    expect(mocks.tx.skillRelationship.create).toHaveBeenCalledWith({
      data: {
        userId: "user-a",
        graphId: "graph-a",
        sourceSkillNodeId: "node-a",
        targetSkillNodeId: "node-z",
        kind: "RELATED",
        origin: "USER",
        status: "CONFIRMED",
      },
    })
  })

  it("preserves the learner's From-to-To direction for prerequisites", async () => {
    await connectSkillRelationship({
      userId: "user-a",
      sourceGoalSkillId: "goal-skill-a",
      targetGoalSkillId: "goal-skill-b",
      kind: "PREREQUISITE",
    })

    expect(mocks.tx.skillRelationship.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceSkillNodeId: "node-z",
        targetSkillNodeId: "node-a",
        kind: "PREREQUISITE",
      }),
    })
  })

  it("rejects a self-link before opening a transaction", async () => {
    await expect(
      connectSkillRelationship({
        userId: "user-a",
        sourceGoalSkillId: "goal-skill-a",
        targetGoalSkillId: "goal-skill-a",
        kind: "RELATED",
      }),
    ).rejects.toMatchObject({ code: "SELF_RELATIONSHIP" })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("keeps prerequisite direction and rejects a cycle", async () => {
    mocks.tx.skillRelationship.findMany.mockResolvedValue([
      { sourceSkillNodeId: "node-a", targetSkillNodeId: "node-middle" },
      { sourceSkillNodeId: "node-middle", targetSkillNodeId: "node-z" },
    ])

    await expect(
      connectSkillRelationship({
        userId: "user-a",
        sourceGoalSkillId: "goal-skill-a",
        targetGoalSkillId: "goal-skill-b",
        kind: "PREREQUISITE",
      }),
    ).rejects.toMatchObject({
      code: "PREREQUISITE_CYCLE",
    })
    expect(mocks.tx.skillRelationship.create).not.toHaveBeenCalled()
  })

  it("rejects unavailable or cross-tenant endpoints without exposing which one", async () => {
    mocks.tx.goalSkill.findMany.mockResolvedValue([ownedSkills()[0]])

    await expect(
      connectSkillRelationship({
        userId: "user-a",
        sourceGoalSkillId: "goal-skill-a",
        targetGoalSkillId: "someone-elses-skill",
        kind: "RELATED",
      }),
    ).rejects.toMatchObject({
      code: "SKILL_UNAVAILABLE",
      publicMessage: "One of those skills is unavailable.",
    })
    expect(mocks.tx.skillRelationship.create).not.toHaveBeenCalled()
  })

  it("rejects duplicate confirmed edges and reactivates removed ones as user links", async () => {
    mocks.tx.skillRelationship.findUnique.mockResolvedValueOnce({
      id: "existing",
      status: "CONFIRMED",
    })
    await expect(
      connectSkillRelationship({
        userId: "user-a",
        sourceGoalSkillId: "goal-skill-a",
        targetGoalSkillId: "goal-skill-b",
        kind: "RELATED",
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_RELATIONSHIP",
    })

    mocks.tx.skillRelationship.findUnique.mockResolvedValueOnce({
      id: "existing",
      status: "REMOVED",
    })
    await connectSkillRelationship({
      userId: "user-a",
      sourceGoalSkillId: "goal-skill-a",
      targetGoalSkillId: "goal-skill-b",
      kind: "RELATED",
    })
    expect(mocks.tx.skillRelationship.update).toHaveBeenLastCalledWith({
      where: { id: "existing" },
      data: {
        origin: "USER",
        status: "CONFIRMED",
        confidence: null,
        rationale: null,
      },
    })
  })

  it("owner-scopes status changes and enforces their lifecycle", async () => {
    mocks.tx.skillRelationship.findFirst.mockResolvedValue({
      id: "suggestion-a",
      status: "SUGGESTED",
    })

    await updateSkillRelationshipStatus({
      userId: "user-a",
      relationshipId: "suggestion-a",
      action: "ACCEPT",
    })

    expect(mocks.tx.skillRelationship.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "suggestion-a",
        userId: "user-a",
        graph: { userId: "user-a" },
      }),
      select: { id: true, status: true },
    })
    expect(mocks.tx.skillRelationship.update).toHaveBeenCalledWith({
      where: { id: "suggestion-a" },
      data: { status: "CONFIRMED" },
    })
  })

  it("detects transitive cycles without looping forever on existing bad input", () => {
    expect(
      wouldCreatePrerequisiteCycle(
        [
          { sourceSkillNodeId: "b", targetSkillNodeId: "c" },
          { sourceSkillNodeId: "c", targetSkillNodeId: "b" },
          { sourceSkillNodeId: "c", targetSkillNodeId: "a" },
        ],
        "a",
        "b",
      ),
    ).toBe(true)
    expect(wouldCreatePrerequisiteCycle([], "a", "b")).toBe(false)
  })
})
