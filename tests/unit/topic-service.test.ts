import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const tx = {
    user: { findUnique: vi.fn() },
    skillGraph: { upsert: vi.fn() },
    learningGoal: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    skillNode: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    goalSkill: {
      create: vi.fn(),
      update: vi.fn(),
    },
    goalSkillScopeVersion: { create: vi.fn() },
    concept: { create: vi.fn(), update: vi.fn() },
    conceptVersion: { create: vi.fn() },
    goalSkillScopeConcept: { create: vi.fn() },
  }
  return { tx, transaction: vi.fn() }
})

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}))

import { createTopic, deriveTopicScope } from "@/lib/learning/topic-service"
import { LearningSetupNotFoundError } from "@/lib/learning/setup-service"

describe("topic-first creation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(
      async (work: (tx: typeof mocks.tx) => unknown) => work(mocks.tx),
    )
    mocks.tx.user.findUnique.mockResolvedValue({ id: "user-a" })
    mocks.tx.learningGoal.findFirst.mockResolvedValue(null)
    mocks.tx.learningGoal.findUnique.mockResolvedValue(null)
    mocks.tx.skillGraph.upsert.mockResolvedValue({ id: "graph-a" })
    mocks.tx.learningGoal.create.mockResolvedValue({ id: "goal-a", graphId: "graph-a" })
    mocks.tx.skillNode.findUnique.mockResolvedValue(null)
    mocks.tx.skillNode.create.mockResolvedValue({ id: "skill-a" })
    mocks.tx.goalSkill.create.mockResolvedValue({ id: "goal-skill-a" })
    mocks.tx.goalSkillScopeVersion.create.mockResolvedValue({ id: "scope-a" })
    mocks.tx.concept.create.mockResolvedValue({ id: "concept-a" })
    mocks.tx.conceptVersion.create.mockResolvedValue({ id: "concept-version-a" })
  })

  it("creates a durable needs-sources leaf from only a natural topic title", async () => {
    await expect(createTopic({ userId: "user-a", title: "  Hashmaps  " })).resolves.toEqual({
      goalId: "goal-a",
      goalSkillId: "goal-skill-a",
      skillNodeId: "skill-a",
      scopeVersionId: "scope-a",
      conceptVersionId: "concept-version-a",
      title: "Hashmaps",
      outcome: "Understand and apply Hashmaps.",
      successCriterion:
        "Explain the core ideas of Hashmaps and apply them in a realistic example.",
      topicStatus: "NEEDS_SOURCES",
    })

    expect(mocks.tx.learningGoal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "My skills",
        slug: "skill-library",
        status: "ACTIVE",
      }),
      select: { id: true, graphId: true },
    })
    expect(mocks.tx.skillNode.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        parentId: null,
        kind: "SKILL",
        title: "Hashmaps",
        slug: "hashmaps",
        state: "DRAFT",
      }),
      select: { id: true },
    })
    expect(mocks.tx.skillNode.create).toHaveBeenCalledTimes(1)
    expect(mocks.tx.goalSkill.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ lifecycle: "DRAFT" }),
      select: { id: true },
    })
    expect(mocks.tx.goalSkillScopeVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        creationReason: "TOPIC_PLACEHOLDER",
      }),
      select: { id: true },
    })
  })

  it("reuses the learner's live compatibility goal instead of asking for one", async () => {
    mocks.tx.learningGoal.findFirst.mockResolvedValue({
      id: "goal-existing",
      graphId: "graph-a",
      graph: { userId: "user-a" },
    })
    mocks.tx.skillNode.create
      .mockReset()
      .mockResolvedValue({ id: "skill-a" })

    const result = await createTopic({ userId: "user-a", title: "Arrays" })

    expect(result.goalId).toBe("goal-existing")
    expect(mocks.tx.skillGraph.upsert).not.toHaveBeenCalled()
    expect(mocks.tx.learningGoal.create).not.toHaveBeenCalled()
  })

  it("reactivates the internal default when no other goal is live", async () => {
    mocks.tx.learningGoal.findUnique.mockResolvedValue({
      id: "goal-default",
      graphId: "graph-a",
      graph: { userId: "user-a" },
    })
    mocks.tx.learningGoal.update.mockResolvedValue({
      id: "goal-default",
      graphId: "graph-a",
    })

    const result = await createTopic({ userId: "user-a", title: "Queues" })

    expect(result.goalId).toBe("goal-default")
    expect(mocks.tx.learningGoal.update).toHaveBeenCalledWith({
      where: { id: "goal-default" },
      data: { status: "ACTIVE" },
      select: { id: true, graphId: true },
    })
  })

  it("does not create tenant data for a missing session user", async () => {
    mocks.tx.user.findUnique.mockResolvedValue(null)

    await expect(
      createTopic({ userId: "missing-user", title: "Trees" }),
    ).rejects.toBeInstanceOf(LearningSetupNotFoundError)
    expect(mocks.tx.skillGraph.upsert).not.toHaveBeenCalled()
    expect(mocks.tx.skillNode.create).not.toHaveBeenCalled()
  })

  it("derives bounded placeholder scope copy without asking the learner", () => {
    expect(deriveTopicScope("React hooks")).toEqual({
      outcome: "Understand and apply React hooks.",
      successCriterion:
        "Explain the core ideas of React hooks and apply them in a realistic example.",
    })
  })
})
