import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  practiceSessionFindFirst: vi.fn(),
  learningGapFindMany: vi.fn(),
  goalSkillFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    practiceSession: { findFirst: mocks.practiceSessionFindFirst },
    learningGap: { findMany: mocks.learningGapFindMany },
    goalSkill: { findMany: mocks.goalSkillFindMany },
  },
}))

import {
  dueStateAt,
  getTodayData,
  readinessReason,
  selectTodayData,
  type TodayCandidate,
  type TodayStrengthenCandidate,
} from "@/lib/learning/today-query"

const selectionNow = new Date("2026-09-04T12:00:00.000Z")

function candidate({
  id,
  lifecycle = "ACTIVE",
  dueAt,
  createdAt = new Date("2026-09-01T12:00:00.000Z"),
}: {
  id: string
  lifecycle?: string
  dueAt: Date | null
  createdAt?: Date
}): TodayCandidate {
  return {
    goalId: "goal-a",
    goalTitle: "My skills",
    goalOutcome: "Learn what matters",
    goalSkillId: id,
    branchTitle: "Core skills",
    title: id,
    outcome: `Understand ${id}`,
    successCriterion: `Explain ${id}`,
    stage: "UNASSESSED",
    confidence: "LOW",
    evidenceCount: 0,
    successCount: 0,
    reason: "No reviews yet",
    lifecycle,
    createdAt,
    dueAt,
  }
}

function strengthenCandidate({
  gapId,
  goalSkillId = "arrays",
  openedAt = new Date("2026-09-04T09:00:00.000Z"),
}: {
  gapId: string
  goalSkillId?: string
  openedAt?: Date
}): TodayStrengthenCandidate {
  return {
    gapId,
    goalSkillId,
    skillTitle: goalSkillId,
    gapLabel: `Explain ${goalSkillId} precisely`,
    openedAt,
  }
}

describe("today due-state presentation", () => {
  const now = new Date("2026-09-02T12:00:00.000Z")

  it("separates current, due, and overdue without changing mastery", () => {
    expect(dueStateAt(new Date("2026-09-02T13:00:00.000Z"), now)).toBe("CURRENT")
    expect(dueStateAt(new Date("2026-09-02T11:00:00.000Z"), now)).toBe("DUE")
    expect(dueStateAt(new Date("2026-09-01T11:59:59.000Z"), now)).toBe("OVERDUE")
  })
})

describe("today readiness explanation", () => {
  it("makes a lapse visible instead of describing only historical successes", () => {
    expect(
      readinessReason({
        stage: "LEARNING",
        successfulFullWeightReviews: 8,
        distinctReviewDays: 10,
        latestRating: "AGAIN",
      }),
    ).toBe("Latest recall missed · refresh scheduled")
  })
})

describe("today multi-skill selection", () => {
  it("honors an explicit review even when another skill needs repair", () => {
    const selected = candidate({ id: "hashmaps", dueAt: new Date("2026-09-04T10:00:00Z") })
    expect(selectTodayData([selected], null, selectionNow, "hashmaps", [strengthenCandidate({ gapId: "gap-other" })]))
      .toMatchObject({ kind: "REVIEW", leaf: { goalSkillId: "hashmaps" } })
  })

  it("explains a conflicting session instead of silently switching skills", () => {
    const leaves = ["hashmaps", "arrays"].map((id) => candidate({ id, dueAt: new Date("2026-09-04T10:00:00Z") }))
    expect(selectTodayData(leaves, { id: "session-arrays", goalId: "goal-a", goalSkillId: "arrays", dueAt: leaves[1].dueAt }, selectionNow, "hashmaps"))
      .toEqual({ kind: "SESSION_CONFLICT", requestedTitle: "hashmaps", activeTitle: "arrays", sessionId: "session-arrays" })
  })

  it("selects the earliest due review across active leaves", () => {
    const result = selectTodayData(
      [
        candidate({
          id: "arrays",
          dueAt: new Date("2026-09-04T11:00:00.000Z"),
        }),
        candidate({
          id: "hashmaps",
          dueAt: new Date("2026-09-03T09:00:00.000Z"),
        }),
      ],
      null,
      selectionNow,
    )

    expect(result).toMatchObject({
      kind: "REVIEW",
      leaf: { goalSkillId: "hashmaps", dueState: "OVERDUE" },
    })
  })

  it("honors a selected due leaf when the tree links into Today", () => {
    const result = selectTodayData(
      [
        candidate({
          id: "earliest-due",
          dueAt: new Date("2026-09-03T09:00:00.000Z"),
        }),
        candidate({
          id: "selected-due",
          dueAt: new Date("2026-09-04T11:00:00.000Z"),
        }),
      ],
      null,
      selectionNow,
      "selected-due",
    )

    expect(result).toMatchObject({
      kind: "REVIEW",
      leaf: { goalSkillId: "selected-due" },
    })
  })

  it("continues an incomplete leaf at its source step", () => {
    const result = selectTodayData(
      [candidate({ id: "tries", lifecycle: "DRAFT", dueAt: null })],
      null,
      selectionNow,
    )

    expect(result).toEqual({
      kind: "SETUP_SOURCE",
      goalId: "goal-a",
      goalSkillId: "tries",
      goalTitle: "My skills",
      skillTitle: "tries",
      href: "/skills/tries/sources",
    })
  })

  it("does not let an older unfinished leaf hide due work", () => {
    const result = selectTodayData(
      [
        candidate({
          id: "unfinished",
          lifecycle: "READY",
          dueAt: null,
          createdAt: new Date("2026-08-01T12:00:00.000Z"),
        }),
        candidate({
          id: "due-skill",
          dueAt: new Date("2026-09-04T10:00:00.000Z"),
          createdAt: new Date("2026-09-01T12:00:00.000Z"),
        }),
      ],
      null,
      selectionNow,
    )

    expect(result).toMatchObject({
      kind: "REVIEW",
      leaf: { goalSkillId: "due-skill" },
    })
  })

  it("resumes an active session before selecting another due leaf", () => {
    const result = selectTodayData(
      [
        candidate({
          id: "earliest-due",
          dueAt: new Date("2026-09-03T10:00:00.000Z"),
        }),
        candidate({
          id: "in-progress",
          dueAt: new Date("2026-09-04T10:00:00.000Z"),
        }),
      ],
      {
        id: "session-a",
        goalId: "goal-a",
        goalSkillId: "in-progress",
        dueAt: new Date("2026-09-04T10:00:00.000Z"),
      },
      selectionNow,
      undefined,
      [strengthenCandidate({ gapId: "gap-a" })],
    )

    expect(result).toMatchObject({
      kind: "RESUME",
      sessionId: "session-a",
      leaf: { goalSkillId: "in-progress" },
    })
  })

  it("selects the oldest unfinished Strengthen task before recall or setup", () => {
    const result = selectTodayData(
      [
        candidate({
          id: "due-skill",
          dueAt: new Date("2026-09-03T10:00:00.000Z"),
        }),
        candidate({ id: "unfinished", lifecycle: "READY", dueAt: null }),
      ],
      null,
      selectionNow,
      undefined,
      [
        strengthenCandidate({
          gapId: "gap-newer",
          goalSkillId: "hashmaps",
          openedAt: new Date("2026-09-04T10:00:00.000Z"),
        }),
        strengthenCandidate({
          gapId: "gap-older",
          goalSkillId: "arrays",
          openedAt: new Date("2026-09-03T10:00:00.000Z"),
        }),
      ],
    )

    expect(result).toEqual({
      kind: "STRENGTHEN",
      gapId: "gap-older",
      goalSkillId: "arrays",
      skillTitle: "arrays",
      gapLabel: "Explain arrays precisely",
      href: "/skills/arrays/strengthen/gap-older",
    })
  })

  it("points an empty Today state to topic creation", () => {
    expect(selectTodayData([], null, selectionNow)).toEqual({
      kind: "EMPTY",
      href: "/today/new",
    })
  })
})

describe("today owned leaf query", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.practiceSessionFindFirst.mockResolvedValue(null)
    mocks.learningGapFindMany.mockResolvedValue([])
  })

  it("loads every owned live leaf before selecting the earliest due review", async () => {
    function storedLeaf(id: string, dueAt: Date) {
      return {
        id,
        lifecycle: "ACTIVE",
        createdAt: new Date("2026-09-01T12:00:00.000Z"),
        goal: { id: "goal-a", title: "My skills", outcome: "Keep learning" },
        skillNode: {
          title: id,
          outcome: `Understand ${id}`,
          defaultSuccessCriterion: `Explain ${id}`,
          parent: { title: "Core skills" },
          questions: [
            {
              goalQuestions: [{ goalId: "goal-a" }],
              reviewSchedules: [{ dueAt }],
            },
          ],
        },
        currentScopeVersion: {
          outcome: `Apply ${id}`,
          successCriterion: `Solve with ${id}`,
          readiness: [],
        },
      }
    }

    mocks.goalSkillFindMany.mockResolvedValue([
      storedLeaf("arrays", new Date("2026-09-04T11:00:00.000Z")),
      storedLeaf("hashmaps", new Date("2026-09-03T09:00:00.000Z")),
    ])

    await expect(getTodayData("user-a", selectionNow)).resolves.toMatchObject({
      kind: "REVIEW",
      leaf: { goalSkillId: "hashmaps" },
    })

    const query = mocks.goalSkillFindMany.mock.calls[0][0]
    expect(query).not.toHaveProperty("take")
    expect(query.where).toEqual({
      userId: "user-a",
      lifecycle: { not: "ARCHIVED" },
      goal: {
        userId: "user-a",
        status: { in: ["ACTIVE", "MAINTAINING"] },
      },
      skillNode: { graph: { userId: "user-a" }, kind: "SKILL" },
    })
    expect(query.select.skillNode.select.questions.where.userId).toBe("user-a")
    expect(
      query.select.skillNode.select.questions.select.reviewSchedules.where,
    ).toEqual({ userId: "user-a" })
  })

  it("discovers only an owned open gap whose latest revision is unfinished", async () => {
    mocks.learningGapFindMany.mockResolvedValue([
      {
        id: "gap-a",
        goalSkillId: "arrays",
        openedAt: new Date("2026-09-02T12:00:00.000Z"),
        goalSkill: { skillNode: { title: "Arrays" } },
        remediationRevisions: [
          {
            id: "revision-2",
            gapLabel: "Choose an array index safely",
            activities: [],
          },
        ],
      },
    ])
    mocks.goalSkillFindMany.mockResolvedValue([])

    await expect(getTodayData("user-a", selectionNow)).resolves.toEqual({
      kind: "STRENGTHEN",
      gapId: "gap-a",
      goalSkillId: "arrays",
      skillTitle: "Arrays",
      gapLabel: "Choose an array index safely",
      href: "/skills/arrays/strengthen/gap-a",
    })

    const query = mocks.learningGapFindMany.mock.calls[0][0]
    expect(query.where).toEqual({
      userId: "user-a",
      status: "OPEN",
      goalSkill: {
        userId: "user-a",
        lifecycle: "ACTIVE",
        goal: {
          userId: "user-a",
          status: { in: ["ACTIVE", "MAINTAINING"] },
        },
        skillNode: { graph: { userId: "user-a" }, kind: "SKILL" },
      },
    })
    expect(query.orderBy).toEqual([{ openedAt: "asc" }, { id: "asc" }])
    expect(query.select.remediationRevisions.orderBy).toEqual([
      { revision: "desc" },
      { id: "asc" },
    ])
    expect(query.select.remediationRevisions.take).toBe(1)
    expect(query.select.remediationRevisions.select.activities).toMatchObject({
      where: { userId: "user-a" },
      take: 1,
    })
  })

  it("does not resurface an open gap after its latest Strengthen revision is done", async () => {
    mocks.learningGapFindMany.mockResolvedValue([
      {
        id: "gap-a",
        goalSkillId: "arrays",
        openedAt: new Date("2026-09-02T12:00:00.000Z"),
        goalSkill: { skillNode: { title: "Arrays" } },
        remediationRevisions: [
          {
            id: "revision-2",
            gapLabel: "Choose an array index safely",
            activities: [{ id: "activity-a" }],
          },
        ],
      },
    ])
    mocks.goalSkillFindMany.mockResolvedValue([])

    await expect(getTodayData("user-a", selectionNow)).resolves.toEqual({
      kind: "EMPTY",
      href: "/today/new",
    })
  })
})
