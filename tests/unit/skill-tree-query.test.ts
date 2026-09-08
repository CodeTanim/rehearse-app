import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  learningGoalFindFirst: vi.fn(),
  learningGoalFindMany: vi.fn(),
  skillRelationshipFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    learningGoal: {
      findFirst: mocks.learningGoalFindFirst,
      findMany: mocks.learningGoalFindMany,
    },
    skillRelationship: {
      findMany: mocks.skillRelationshipFindMany,
    },
  },
}))

import { getOwnedSkillTree, getUserSkillGarden } from "@/lib/learning/skill-tree-query"

const now = new Date("2026-09-04T12:00:00.000Z")

function goalSkill({
  id,
  title,
  branch,
  dueDates = [],
  stage = "LEARNING",
  lifecycle = "ACTIVE",
}: {
  id: string
  title: string
  branch: string
  dueDates?: Date[]
  stage?: string
  lifecycle?: string
}) {
  return {
    id,
    lifecycle,
    skillNode: {
      id: `node-${id}`,
      title,
      outcome: `Understand ${title}`,
      defaultSuccessCriterion: `Explain ${title}`,
      parent: { title: branch },
      questions: dueDates.map((dueAt) => ({
        generatedSpec: null,
        reviewSchedules: [{ dueAt }],
        goalQuestions: [] as Array<{ goalId: string }>,
      })),
    },
    currentScopeVersion: {
      outcome: `Use ${title}`,
      successCriterion: `Solve a ${title} problem`,
      readiness: [
        {
          stage,
          confidence: stage === "WELL_LEARNED" ? "HIGH" : "MEDIUM",
          completedSessions: 4,
          successfulFullWeightReviews: 3,
          distinctReviewDays: 3,
          latestRating: "GOOD",
        },
      ],
    },
  }
}

describe("skill tree query", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns every visible owned leaf with its node identity, readiness, and earliest schedule", async () => {
    mocks.learningGoalFindFirst.mockResolvedValue({
      id: "goal-a",
      title: "Data structures",
      outcome: "Choose the right structure",
      graph: {
        relationships: [
          {
            id: "relationship-a",
            sourceSkillNodeId: "node-arrays",
            targetSkillNodeId: "node-hashmaps",
            kind: "RELATED",
            origin: "USER",
            status: "CONFIRMED",
            confidence: null,
            rationale: null,
            sourceSkillNode: { title: "Arrays" },
            targetSkillNode: { title: "Hashmaps" },
          },
        ],
      },
      goalSkills: [
        goalSkill({
          id: "hashmaps",
          title: "Hashmaps",
          branch: "Data structures",
          dueDates: [
            new Date("2026-09-06T12:00:00.000Z"),
            new Date("2026-09-03T08:00:00.000Z"),
          ],
        }),
        goalSkill({
          id: "arrays",
          title: "Arrays",
          branch: "Data structures",
          dueDates: [new Date("2026-09-05T12:00:00.000Z")],
          stage: "WELL_LEARNED",
        }),
        goalSkill({
          id: "complexity",
          title: "Complexity",
          branch: "Foundations",
          lifecycle: "DRAFT",
        }),
      ],
    })

    const tree = await getOwnedSkillTree("user-a", "goal-a", now)

    expect(tree?.leaves).toHaveLength(3)
    expect(tree?.leaves.map((leaf) => leaf.title)).toEqual([
      "Hashmaps",
      "Arrays",
      "Complexity",
    ])
    expect(tree?.leaves[0]).toMatchObject({
      skillNodeId: "node-hashmaps",
      branchTitle: "Data structures",
      dueState: "OVERDUE",
      dueAt: new Date("2026-09-03T08:00:00.000Z"),
      evidenceCount: 4,
      successCount: 3,
    })
    expect(tree?.leaves[2]).toMatchObject({
      dueState: "NOT_SCHEDULED",
      reason: "Setup is not complete",
    })
    expect(tree?.relationships).toEqual([
      expect.objectContaining({
        id: "relationship-a",
        sourceSkillNodeId: "node-arrays",
        targetSkillNodeId: "node-hashmaps",
        status: "CONFIRMED",
      }),
    ])

    const query = mocks.learningGoalFindFirst.mock.calls[0][0]
    expect(query.where).toEqual({ id: "goal-a", userId: "user-a" })
    expect(query.select.goalSkills.where).toEqual({
      userId: "user-a",
      lifecycle: { not: "ARCHIVED" },
      skillNode: { graph: { userId: "user-a" } },
    })
    expect(query.select.goalSkills).not.toHaveProperty("take")
    expect(
      query.select.goalSkills.select.currentScopeVersion.select.readiness.select,
    ).toHaveProperty("successfulTransferProbes", true)
    expect(query.select.graph.select.relationships.where).toMatchObject({
      userId: "user-a",
      status: "CONFIRMED",
      origin: "USER",
    })
  })

  it("returns null rather than exposing a goal outside the owner scope", async () => {
    mocks.learningGoalFindFirst.mockResolvedValue(null)

    await expect(getOwnedSkillTree("user-a", "someone-elses-goal", now)).resolves.toBeNull()
  })

  it("does not advertise a transfer-only schedule before familiar recall is available", async () => {
    const baseLeaf = goalSkill({
      id: "hashmaps",
      title: "Hashmaps",
      branch: "Data structures",
      dueDates: [],
    })
    const leafWithTransferOnly = {
      ...baseLeaf,
      skillNode: {
        ...baseLeaf.skillNode,
        questions: [
          {
            generatedSpec: { role: "TRANSFER" },
            reviewSchedules: [{ dueAt: new Date("2026-09-03T08:00:00.000Z") }],
          },
        ],
      },
    }
    mocks.learningGoalFindFirst.mockResolvedValue({
      id: "goal-a",
      title: "Data structures",
      outcome: "Choose the right structure",
      graph: { relationships: [] },
      goalSkills: [leafWithTransferOnly],
    })

    const tree = await getOwnedSkillTree("user-a", "goal-a", now)

    expect(tree?.leaves[0]).toMatchObject({
      dueAt: null,
      dueState: "NOT_SCHEDULED",
    })
  })

  it("combines every live goal, dedupes shared nodes, and keeps graph-wide user connections", async () => {
    const arraysA = goalSkill({
      id: "arrays-a",
      title: "Arrays",
      branch: "Data structures",
      dueDates: [new Date("2026-09-03T08:00:00.000Z")],
    })
    const hashmaps = goalSkill({
      id: "hashmaps",
      title: "Hashmaps",
      branch: "Data structures",
    })
    const arraysB = goalSkill({ id: "arrays-b", title: "Arrays", branch: "Foundations" })
    const caching = goalSkill({ id: "caching", title: "Caching", branch: "Performance" })
    arraysA.skillNode.questions = arraysA.skillNode.questions.map((question) => ({
      ...question,
      goalQuestions: [{ goalId: "goal-a" }],
    }))
    arraysA.skillNode.questions.push({
      generatedSpec: null,
      reviewSchedules: [{ dueAt: new Date("2026-09-01T08:00:00.000Z") }],
      goalQuestions: [{ goalId: "goal-b" }],
    })
    hashmaps.skillNode.questions = hashmaps.skillNode.questions.map((question) => ({
      ...question,
      goalQuestions: [{ goalId: "goal-a" }],
    }))
    arraysB.skillNode.id = "node-arrays-a"
    arraysB.skillNode.questions = arraysB.skillNode.questions.map((question) => ({
      ...question,
      goalQuestions: [{ goalId: "goal-b" }],
    }))
    caching.skillNode.questions = caching.skillNode.questions.map((question) => ({
      ...question,
      goalQuestions: [{ goalId: "goal-b" }],
    }))

    mocks.learningGoalFindMany.mockResolvedValue([
      {
        id: "goal-a",
        title: "Data structures",
        outcome: "Choose a structure",
        goalSkills: [arraysA, hashmaps],
      },
      {
        id: "goal-b",
        title: "Performance",
        outcome: "Make systems faster",
        goalSkills: [arraysB, caching],
      },
    ])
    mocks.skillRelationshipFindMany.mockResolvedValue([
      {
        id: "relationship-cross-goal",
        sourceSkillNodeId: "node-hashmaps",
        targetSkillNodeId: "node-caching",
        kind: "RELATED",
        origin: "USER",
        status: "CONFIRMED",
        confidence: null,
        rationale: null,
        sourceSkillNode: { title: "Hashmaps" },
        targetSkillNode: { title: "Caching" },
      },
      {
        id: "relationship-hidden-endpoint",
        sourceSkillNodeId: "node-hashmaps",
        targetSkillNodeId: "node-archived",
        kind: "RELATED",
        origin: "USER",
        status: "CONFIRMED",
        confidence: null,
        rationale: null,
        sourceSkillNode: { title: "Hashmaps" },
        targetSkillNode: { title: "Archived" },
      },
    ])

    const garden = await getUserSkillGarden("user-a", now)

    expect(garden).toMatchObject({
      goalTitle: "Your knowledge garden",
      relationships: [
        expect.objectContaining({
          id: "relationship-cross-goal",
          sourceSkillNodeId: "node-hashmaps",
          targetSkillNodeId: "node-caching",
        }),
      ],
    })
    expect(garden?.leaves.map((leaf) => leaf.title)).toEqual([
      "Arrays",
      "Hashmaps",
      "Caching",
    ])
    expect(garden?.leaves[0]).toMatchObject({
      goalId: "goal-a",
      goalSkillId: "arrays-a",
      skillNodeId: "node-arrays-a",
      dueAt: new Date("2026-09-03T08:00:00.000Z"),
      dueState: "OVERDUE",
    })
    expect(mocks.learningGoalFindMany.mock.calls[0][0]).toMatchObject({
      where: { userId: "user-a", status: { in: ["ACTIVE", "MAINTAINING"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })
    expect(
      mocks.learningGoalFindMany.mock.calls[0][0].select.goalSkills.select.skillNode.select
        .questions.select.goalQuestions.select,
    ).toEqual({ goalId: true })
    expect(mocks.learningGoalFindFirst).not.toHaveBeenCalled()
    expect(mocks.skillRelationshipFindMany.mock.calls[0][0].where).toMatchObject({
      userId: "user-a",
      status: "CONFIRMED",
      origin: "USER",
    })
  })

  it("returns null when the user has no live goals", async () => {
    mocks.learningGoalFindMany.mockResolvedValue([])
    mocks.skillRelationshipFindMany.mockResolvedValue([])

    await expect(getUserSkillGarden("user-a", now)).resolves.toBeNull()
    expect(mocks.learningGoalFindFirst).not.toHaveBeenCalled()
    expect(mocks.skillRelationshipFindMany).toHaveBeenCalledOnce()
  })
})
