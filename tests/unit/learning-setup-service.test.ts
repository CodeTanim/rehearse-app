import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      findUnique: vi.fn(),
    },
    skillGraph: {
      upsert: vi.fn(),
    },
    learningGoal: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    skillNode: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    goalSkill: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    goalSkillScopeVersion: {
      create: vi.fn(),
    },
    concept: {
      create: vi.fn(),
      update: vi.fn(),
    },
    conceptVersion: {
      create: vi.fn(),
    },
    goalSkillScopeConcept: {
      create: vi.fn(),
    },
    goalQuestion: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    question: {
      create: vi.fn(),
      update: vi.fn(),
    },
    questionRevision: {
      create: vi.fn(),
    },
    questionRevisionConcept: {
      create: vi.fn(),
    },
    reviewSchedule: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    goalSkillReadiness: {
      upsert: vi.fn(),
    },
    practiceSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    practiceSessionItem: {
      create: vi.fn(),
    },
    practiceResponseCheckpoint: {
      create: vi.fn(),
    },
  }

  return {
    tx,
    transaction: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}))

import {
  createActiveLearningGoal,
  createManualQuestion,
  createSkillLeaf,
  LearningSetupConflictError,
  LearningSetupNotFoundError,
  selectRecallQueue,
  startOrResumePracticeSession,
} from "@/lib/learning/setup-service"

const now = new Date("2026-09-02T14:00:00.000Z")

describe("manual learning setup service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(
      async (work: (tx: typeof mocks.tx) => unknown) => work(mocks.tx),
    )

    mocks.tx.user.findUnique.mockResolvedValue({ id: "user-a" })
    mocks.tx.learningGoal.findFirst.mockResolvedValue(null)
    mocks.tx.learningGoal.findUnique.mockResolvedValue(null)
    mocks.tx.skillGraph.upsert.mockResolvedValue({ id: "graph-a" })
    mocks.tx.skillNode.findUnique.mockResolvedValue(null)
    mocks.tx.skillNode.findFirst.mockResolvedValue({ id: "branch-a" })
    mocks.tx.skillNode.create.mockResolvedValue({ id: "node-a" })
    mocks.tx.learningGoal.create.mockResolvedValue({ id: "goal-a" })
    mocks.tx.goalSkill.create.mockResolvedValue({ id: "goal-skill-a" })
    mocks.tx.goalSkill.update.mockResolvedValue({ id: "goal-skill-a" })
    mocks.tx.goalSkillScopeVersion.create.mockResolvedValue({ id: "scope-a" })
    mocks.tx.concept.create.mockResolvedValue({ id: "concept-a" })
    mocks.tx.conceptVersion.create.mockResolvedValue({ id: "concept-version-a" })
    mocks.tx.concept.update.mockResolvedValue({ id: "concept-a" })
    mocks.tx.goalSkillScopeConcept.create.mockResolvedValue({ id: "scope-concept-a" })
    mocks.tx.goalQuestion.findFirst.mockResolvedValue(null)
    mocks.tx.question.create.mockResolvedValue({ id: "question-a" })
    mocks.tx.questionRevision.create.mockResolvedValue({ id: "revision-a" })
    mocks.tx.questionRevisionConcept.create.mockResolvedValue({ id: "revision-concept-a" })
    mocks.tx.question.update.mockResolvedValue({ id: "question-a" })
    mocks.tx.goalQuestion.create.mockResolvedValue({ id: "goal-question-a" })
    mocks.tx.reviewSchedule.create.mockResolvedValue({ id: "schedule-a" })
    mocks.tx.goalSkillReadiness.upsert.mockResolvedValue({ id: "readiness-a" })
    mocks.tx.practiceSession.findFirst.mockResolvedValue(null)
    mocks.tx.practiceSession.create.mockResolvedValue({ id: "session-a" })
    mocks.tx.practiceSessionItem.create.mockResolvedValue({ id: "session-item-a" })
    mocks.tx.practiceResponseCheckpoint.create.mockResolvedValue({ id: "checkpoint-a" })
  })

  it("creates the user's graph and single active goal without a branch", async () => {
    await expect(
      createActiveLearningGoal({
        userId: "user-a",
        title: "HTTP caching",
        outcome: "Design a safe cache.",
      }),
    ).resolves.toEqual({
      goalId: "goal-a",
      graphId: "graph-a",
    })

    expect(mocks.tx.learningGoal.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-a",
        status: { in: ["ACTIVE", "MAINTAINING"] },
      },
      select: { id: true },
    })
    expect(mocks.tx.skillNode.create).not.toHaveBeenCalled()
    expect(mocks.tx.learningGoal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-a",
        graphId: "graph-a",
        slug: "http-caching",
        status: "ACTIVE",
      }),
      select: { id: true },
    })
    expect(mocks.transaction).toHaveBeenCalledOnce()
  })

  it("rejects a second live goal before writing graph data", async () => {
    mocks.tx.learningGoal.findFirst.mockResolvedValue({ id: "goal-existing" })

    await expect(
      createActiveLearningGoal({
        userId: "user-a",
        title: "Another goal",
        outcome: "Learn another thing.",
      }),
    ).rejects.toBeInstanceOf(LearningSetupConflictError)

    expect(mocks.tx.skillGraph.upsert).not.toHaveBeenCalled()
    expect(mocks.tx.learningGoal.create).not.toHaveBeenCalled()
  })

  it("creates a leaf, immutable scope, and required concept before marking it ready", async () => {
    mocks.tx.learningGoal.findFirst.mockResolvedValue({ id: "goal-a", graphId: "graph-a" })
    mocks.tx.skillNode.create.mockResolvedValue({ id: "skill-a" })

    await expect(
      createSkillLeaf({
        userId: "user-a",
        goalId: "goal-a",
        title: "Cache invalidation",
        outcome: "Choose an invalidation strategy.",
        successCriterion: "Compare two approaches.",
      }),
    ).resolves.toEqual({
      goalSkillId: "goal-skill-a",
      skillNodeId: "skill-a",
      scopeVersionId: "scope-a",
      conceptVersionId: "concept-version-a",
    })

    expect(mocks.tx.learningGoal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "goal-a", userId: "user-a" }),
      }),
    )
    expect(mocks.tx.skillNode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        graphId: "graph-a",
        parentId: null,
        kind: "SKILL",
        title: "Cache invalidation",
      }),
      select: { id: true },
    })
    expect(mocks.tx.goalSkillScopeVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        goalSkillId: "goal-skill-a",
        version: 1,
        policyVersion: "mastery-v1",
      }),
      select: { id: true },
    })
    expect(mocks.tx.goalSkillScopeConcept.create).toHaveBeenCalledWith({
      data: {
        scopeVersionId: "scope-a",
        conceptVersionId: "concept-version-a",
        requirement: "REQUIRED",
        weight: 1,
      },
    })
    expect(mocks.tx.goalSkill.update).toHaveBeenLastCalledWith({
      where: { id: "goal-skill-a" },
      data: {
        currentScopeVersionId: "scope-a",
        lifecycle: "READY",
      },
    })
  })

  it("activates a leaf only after a manual revision, primary link, due schedule, and readiness exist", async () => {
    mocks.tx.goalSkill.findFirst.mockResolvedValue(ownedReadyGoalSkill())

    await expect(
      createManualQuestion(
        {
          userId: "user-a",
          goalSkillId: "goal-skill-a",
          prompt: "When should a cached response be invalidated?",
          referenceAnswer: "When its freshness contract no longer holds.",
        },
        { now },
      ),
    ).resolves.toEqual({
      questionId: "question-a",
      questionRevisionId: "revision-a",
      reviewScheduleId: "schedule-a",
    })

    expect(mocks.tx.questionRevisionConcept.create).toHaveBeenCalledWith({
      data: {
        questionRevisionId: "revision-a",
        conceptVersionId: "concept-version-a",
        isPrimary: true,
      },
    })
    expect(mocks.tx.reviewSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-a",
        dueAt: now,
        intervalMinutes: 0,
        repetitions: 0,
        lapses: 0,
        algorithmVersion: "schedule-v1",
        version: 0,
      }),
      select: { id: true },
    })
    expect(mocks.tx.goalSkillReadiness.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          stage: "UNASSESSED",
          confidence: "LOW",
          earliestDueAt: now,
        }),
      }),
    )
    expect(mocks.tx.goalSkill.update).toHaveBeenLastCalledWith({
      where: { id: "goal-skill-a" },
      data: { lifecycle: "ACTIVE" },
    })
    expect(mocks.tx.goalSkill.update.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.tx.reviewSchedule.create.mock.invocationCallOrder[0],
    )
  })

  it("uses the same not-found result for an unavailable or cross-owner goal skill", async () => {
    mocks.tx.goalSkill.findFirst.mockResolvedValue(null)

    await expect(
      createManualQuestion({
        userId: "user-a",
        goalSkillId: "owned-by-someone-else",
        prompt: "Recall this.",
        referenceAnswer: "Reference.",
      }),
    ).rejects.toBeInstanceOf(LearningSetupNotFoundError)

    expect(mocks.tx.question.create).not.toHaveBeenCalled()
  })

  it("starts one due review with immutable schedule snapshots", async () => {
    mocks.tx.goalSkill.findFirst.mockResolvedValue(ownedActiveGoalSkill())
    mocks.tx.reviewSchedule.findMany.mockResolvedValue([{
      id: "schedule-a",
      questionId: "question-a",
      questionRevisionId: "revision-a",
      dueAt: now,
      intervalMinutes: 0,
      repetitions: 0,
      lapses: 0,
      algorithmVersion: "schedule-v1",
      question: { currentRevisionId: "revision-a", generatedSpec: null },
      questionRevision: {
        concepts: [{ conceptVersionId: "concept-version-a" }],
      },
    }])

    await expect(
      startOrResumePracticeSession(
        { userId: "user-a", goalSkillId: "goal-skill-a" },
        { now },
      ),
    ).resolves.toEqual({
      sessionId: "session-a",
      sessionItemId: "session-item-a",
      resumed: false,
    })

    expect(mocks.tx.practiceSession.create).toHaveBeenCalledWith({
      data: {
        userId: "user-a",
        goalId: "goal-a",
        goalSkillId: "goal-skill-a",
        reason: "BASELINE",
        status: "ACTIVE",
        targetCount: 1,
      },
      select: { id: true },
    })
    expect(mocks.tx.practiceSessionItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "session-a",
        scheduleDueAtBefore: now,
        intervalMinutesBefore: 0,
        repetitionsBefore: 0,
        lapsesBefore: 0,
        scheduleAlgorithmVersion: "schedule-v1",
      }),
      select: { id: true },
    })
    expect(mocks.tx.practiceResponseCheckpoint.create).toHaveBeenCalledWith({
      data: {
        sessionItemId: "session-item-a",
        userId: "user-a",
        phase: "PROMPT",
        draftAnswer: "",
        version: 0,
      },
    })
  })

  it("resumes the user's open checkpoint instead of creating another session", async () => {
    mocks.tx.practiceSession.findFirst.mockResolvedValue({
      id: "session-open",
      goalSkillId: "goal-skill-a",
      goal: { userId: "user-a" },
      goalSkill: { userId: "user-a" },
      items: [
        {
          id: "item-open",
          question: { userId: "user-a" },
          responseCheckpoint: { id: "checkpoint-open", userId: "user-a" },
        },
      ],
    })

    await expect(
      startOrResumePracticeSession({
        userId: "user-a",
        goalSkillId: "goal-skill-a",
      }),
    ).resolves.toEqual({
      sessionId: "session-open",
      sessionItemId: "item-open",
      resumed: true,
    })

    expect(mocks.tx.goalSkill.findFirst).not.toHaveBeenCalled()
    expect(mocks.tx.practiceSession.create).not.toHaveBeenCalled()
  })

  it("never resumes another skill when the user explicitly starts this skill", async () => {
    mocks.tx.practiceSession.findFirst.mockResolvedValue({ id: "other-session", goalSkillId: "other-skill" })
    await expect(startOrResumePracticeSession({ userId: "user-a", goalSkillId: "goal-skill-a" }))
      .rejects.toThrow("Another skill has a recall in progress")
    expect(mocks.tx.practiceSession.create).not.toHaveBeenCalled()
  })

  it("validates input before opening a transaction", async () => {
    await expect(
      createSkillLeaf({
        userId: "user-a",
        goalId: "goal-a",
        title: "",
        outcome: "An outcome",
        successCriterion: "A check",
      }),
    ).rejects.toMatchObject({ name: "ZodError" })

    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

describe("recall queue composition", () => {
  const core = (id: number) => ({ id, generatedSpec: { role: "CORE" } })
  const transfer = (id: number) => ({ id, generatedSpec: { role: "TRANSFER" } })

  it("adds one new angle to four familiar items and keeps another withheld", () => {
    expect(
      selectRecallQueue([
        core(1), core(2), core(3), core(4), transfer(5), transfer(6),
      ]).map((item) => item.id),
    ).toEqual([1, 2, 3, 4, 5])
  })

  it("does not present a transfer probe without enough familiar context", () => {
    expect(selectRecallQueue([core(1), core(2), core(3), transfer(4)])).toHaveLength(3)
    expect(selectRecallQueue([transfer(1), transfer(2)])).toHaveLength(0)
  })

  it("puts due questions for open competency gaps first without changing the mix", () => {
    expect(
      selectRecallQueue([
        core(1),
        core(2),
        { ...core(3), hasOpenGap: true },
        core(4),
        transfer(5),
      ]).map((item) => item.id),
    ).toEqual([3, 1, 2, 4, 5])
  })
})

function ownedReadyGoalSkill() {
  return {
    id: "goal-skill-a",
    goalId: "goal-a",
    skillNodeId: "skill-a",
    currentScopeVersionId: "scope-a",
    currentScopeVersion: {
      id: "scope-a",
      goalSkillId: "goal-skill-a",
      concepts: [
        {
          conceptVersionId: "concept-version-a",
          conceptVersion: {
            concept: { skillNodeId: "skill-a" },
          },
        },
      ],
    },
  }
}

function ownedActiveGoalSkill() {
  return {
    id: "goal-skill-a",
    goalId: "goal-a",
    skillNodeId: "skill-a",
    currentScopeVersionId: "scope-a",
    currentScopeVersion: {
      id: "scope-a",
      goalSkillId: "goal-skill-a",
      concepts: [
        {
          conceptVersionId: "concept-version-a",
          conceptVersion: {
            concept: { skillNodeId: "skill-a" },
          },
        },
      ],
    },
  }
}
