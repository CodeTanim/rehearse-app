import type { PrismaClient } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const remediationMocks = vi.hoisted(() => ({
  createOrReopenRecallGapInTransaction: vi.fn(),
  resolveLearningGapFromRecallInTransaction: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/learning/remediation-service", () => remediationMocks)

import {
  createPracticeService,
  PracticeServiceError,
  type PracticeSummary,
} from "@/lib/learning/practice-service"

const NOW = new Date("2026-09-02T16:00:00.000Z")
const DUE_AT = new Date("2026-09-02T15:00:00.000Z")
const PRESENTED_AT = new Date("2026-09-02T15:59:30.000Z")
const MULTIPLE_CHOICE_CHOICES = [
  "Evict every entry",
  "Version cache keys",
  "Increase the TTL",
  "Disable caching",
]

function generatedMultipleChoiceSpec(
  overrides: Record<string, unknown> = {},
) {
  return {
    responseType: "MULTIPLE_CHOICE",
    choicesJson: JSON.stringify(MULTIPLE_CHOICE_CHOICES),
    correctChoiceIndex: 1,
    role: "CORE",
    questionFamilyId: "cache-invalidation-family",
    sourceVersionId: "source-version-a",
    citationLocator: "Cache notes · paragraph 2",
    citationExcerpt: "Version cache keys when invalidation is uncertain.",
    ...overrides,
  }
}

function checkpoint(overrides: Record<string, unknown> = {}) {
  return {
    id: "checkpoint-a",
    phase: "DRAFTING",
    draftAnswer: "saved answer",
    lockedAnswer: null,
    version: 2,
    revealedAt: null,
    ...overrides,
  }
}

function ownedCheckpointItem(value = checkpoint()) {
  return {
    id: "item-a",
    status: "PRESENTED",
    session: { status: "ACTIVE" },
    responseCheckpoint: value,
  }
}

function ownedGeneratedCheckpointItem(value = checkpoint()) {
  return {
    ...ownedCheckpointItem(value),
    question: { generatedSpec: generatedMultipleChoiceSpec() },
  }
}

function gradeItem() {
  return {
    id: "item-a",
    status: "PRESENTED",
    questionId: "question-a",
    questionRevisionId: "revision-a",
    scheduleDueAtBefore: DUE_AT,
    intervalMinutesBefore: 0,
    repetitionsBefore: 0,
    lapsesBefore: 0,
    scheduleAlgorithmVersion: "schedule-v1",
    presentedAt: PRESENTED_AT,
    attempt: null,
    responseCheckpoint: checkpoint({
      phase: "REVEALED",
      draftAnswer: "  my exact answer  ",
      lockedAnswer: "  my exact answer  ",
      revealedAt: new Date("2026-09-02T15:59:45.000Z"),
    }),
    question: {
      userId: "user-a",
      state: "ACTIVE",
      schedulingEligible: true,
      skillNodeId: "skill-a",
      generatedSpec: null,
    },
    questionRevision: {
      questionId: "question-a",
      referenceAnswer: "Version cache keys when invalidation is uncertain.",
      explanation: "A version bump makes stale entries unreachable.",
      concepts: [
        {
          conceptVersionId: "concept-version-a",
          conceptVersion: {
            title: "Cache versioning",
            concept: { skillNodeId: "skill-a" },
          },
        },
      ],
    },
    session: {
      id: "session-a",
      status: "ACTIVE",
      targetCount: 1,
      goalId: "goal-a",
      goalSkillId: "goal-skill-a",
      user: { timezone: "UTC" },
      goal: { userId: "user-a" },
      goalSkill: {
        id: "goal-skill-a",
        userId: "user-a",
        goalId: "goal-a",
        lifecycle: "ACTIVE",
        skillNodeId: "skill-a",
        currentScopeVersionId: "scope-a",
        skillNode: {
          title: "Cache invalidation",
          graph: { userId: "user-a" },
        },
        currentScopeVersion: {
          id: "scope-a",
          goalSkillId: "goal-skill-a",
          concepts: [{ conceptVersionId: "concept-version-a" }],
        },
      },
    },
  }
}

function generatedGradeItem({
  lockedAnswer = "1",
  correctChoiceIndex = 1,
  role = "CORE",
  questionFamilyId = "cache-invalidation-family",
}: {
  lockedAnswer?: string
  correctChoiceIndex?: number
  role?: "CORE" | "TRANSFER"
  questionFamilyId?: string
} = {}) {
  const item = gradeItem()
  return {
    ...item,
    responseCheckpoint: checkpoint({
      phase: "REVEALED",
      draftAnswer: lockedAnswer,
      lockedAnswer,
      revealedAt: new Date("2026-09-02T15:59:45.000Z"),
    }),
    question: {
      ...item.question,
      generatedSpec: generatedMultipleChoiceSpec({
        correctChoiceIndex,
        role,
        questionFamilyId,
      }),
    },
  }
}

function generatedShortResponseGradeItem() {
  const item = gradeItem()
  return {
    ...item,
    question: {
      ...item.question,
      generatedSpec: {
        responseType: "SHORT_RESPONSE",
        choicesJson: "[]",
        correctChoiceIndex: null,
        role: "CORE",
        questionFamilyId: "cache-versioning-explanation",
        sourceVersionId: "source-version-a",
        citationLocator: "Cache notes · paragraph 2",
        citationExcerpt: "Version cache keys when invalidation is uncertain.",
      },
    },
  }
}

function makeDatabase() {
  const transaction = vi.fn()
  const tx = {
    practiceSessionItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    practiceResponseCheckpoint: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    reviewSchedule: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    attempt: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    masteryEvidence: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    goalSkillReadiness: { upsert: vi.fn() },
    practiceSession: { update: vi.fn() },
  }
  const database = {
    $transaction: transaction,
    attempt: { findFirst: vi.fn() },
    practiceSessionItem: { findFirst: vi.fn().mockResolvedValue({ id: "item-a" }) },
  }

  transaction.mockImplementation(async (operation: (value: typeof tx) => unknown) =>
    operation(tx),
  )
  return {
    tx,
    transaction,
    database,
    service: createPracticeService(database as unknown as PrismaClient, () => NOW),
  }
}

function prepareSuccessfulGrade(
  context: Pick<ReturnType<typeof makeDatabase>, "database" | "tx">,
  item:
    | ReturnType<typeof gradeItem>
    | ReturnType<typeof generatedGradeItem>
    | ReturnType<typeof generatedShortResponseGradeItem> = gradeItem(),
) {
  const { database, tx } = context
  database.attempt.findFirst.mockResolvedValue(null)
  tx.attempt.findFirst.mockResolvedValue(null)
  tx.practiceSessionItem.findFirst.mockResolvedValue(item)
  tx.reviewSchedule.findUnique.mockResolvedValue({
    id: "schedule-a",
    userId: "user-a",
    questionId: "question-a",
    questionRevisionId: "revision-a",
    dueAt: DUE_AT,
    intervalMinutes: 0,
    repetitions: 0,
    lapses: 0,
    lastReviewedAt: null,
    algorithmVersion: "schedule-v1",
    version: 0,
  })
  tx.masteryEvidence.findMany.mockResolvedValue([])
  tx.reviewSchedule.findMany.mockResolvedValue([
    {
      id: "schedule-a",
      dueAt: DUE_AT,
      intervalMinutes: 0,
      questionRevision: {
        concepts: [{ conceptVersionId: "concept-version-a" }],
      },
    },
  ])
  tx.practiceResponseCheckpoint.updateMany.mockResolvedValue({ count: 1 })
  tx.reviewSchedule.updateMany.mockResolvedValue({ count: 1 })
  tx.attempt.create.mockResolvedValue({ id: "attempt-a" })
  tx.masteryEvidence.create.mockResolvedValue({ id: "evidence-a" })
  tx.goalSkillReadiness.upsert.mockResolvedValue({ id: "readiness-a" })
  tx.practiceSessionItem.update.mockResolvedValue({ id: "item-a" })
  tx.practiceSession.update.mockResolvedValue({ id: "session-a" })
  tx.practiceResponseCheckpoint.delete.mockResolvedValue({ id: "checkpoint-a" })
}

describe("durable practice service", () => {
  it("locks an explicit unknown choice without fabricating a selected option", async () => {
    const { service, tx } = makeDatabase()
    tx.practiceSessionItem.findFirst.mockResolvedValueOnce(ownedGeneratedCheckpointItem()).mockResolvedValueOnce({
      responseCheckpoint: { phase: "REVEALED", lockedAnswer: "", version: 3, revealedAt: NOW },
      questionRevision: { referenceAnswer: "Version cache keys.", explanation: null },
      question: { generatedSpec: generatedMultipleChoiceSpec() },
    })
    tx.practiceResponseCheckpoint.updateMany.mockResolvedValue({ count: 1 })
    const result = await service.reveal({ userId: "user-a", itemId: "item-a", answer: "", skipped: true, expectedVersion: 2 })
    expect(result.checkpoint.lockedAnswer).toBe("")
    expect(result).not.toHaveProperty("objectiveCorrect")
    await expect(service.reveal({ userId: "user-a", itemId: "item-a", answer: "", expectedVersion: 2 })).rejects.toThrow("Write an answer")
    await expect(service.reveal({ userId: "user-a", itemId: "item-a", answer: "1", skipped: true, expectedVersion: 2 })).rejects.toThrow("Write an answer")
  })

  it("saves an unknown recall for retry and repair without mastery evidence", async () => {
    const context = makeDatabase()
    prepareSuccessfulGrade(context, generatedGradeItem({ lockedAnswer: "" }))
    const summary = await context.service.grade({ userId: "user-a", itemId: "item-a", rating: "AGAIN", expectedVersion: 2,
      idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e" })
    expect(summary).toMatchObject({ skipped: true, evidenceWeight: 0, rating: "AGAIN", gapId: "gap-a" })
    expect(summary.stageAfter).toBe(summary.stageBefore)
    expect(context.tx.masteryEvidence.create).not.toHaveBeenCalled()
    expect(context.tx.attempt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lockedAnswer: "" }) }))
    expect(remediationMocks.resolveLearningGapFromRecallInTransaction).not.toHaveBeenCalled()
  })

  it.each(["HARD", "GOOD", "EASY"] as const)("rejects %s credit for skipped or partial responses", async (rating) => {
    for (const skipped of [true, false]) {
      const context = makeDatabase()
      prepareSuccessfulGrade(context, generatedGradeItem({ lockedAnswer: skipped ? "" : "1" }))
      await expect(context.service.grade({ userId: "user-a", itemId: "item-a", rating, ...(skipped ? {} : { assessment: "PARTIAL" as const }),
        expectedVersion: 2, idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e" })).rejects.toThrow("cannot receive learning credit")
      expect(context.tx.attempt.create).not.toHaveBeenCalled()
    }
  })

  it("retains a partial self-assessment in the durable result on the retry path", async () => {
    const context = makeDatabase()
    prepareSuccessfulGrade(context, generatedShortResponseGradeItem())
    const summary = await context.service.grade({ userId: "user-a", itemId: "item-a", rating: "AGAIN", assessment: "PARTIAL", expectedVersion: 2,
      idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e" })
    expect(summary).toMatchObject({ assessment: "PARTIAL", rating: "AGAIN" })
    expect(context.tx.practiceSessionItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ resultJson: JSON.stringify(summary) }) }))
  })
  beforeEach(() => {
    vi.clearAllMocks()
    remediationMocks.createOrReopenRecallGapInTransaction.mockResolvedValue({
      gapId: "gap-a",
      remediationRevisionId: "remediation-a",
      created: true,
      reopened: false,
      alreadyRecorded: false,
    })
    remediationMocks.resolveLearningGapFromRecallInTransaction.mockResolvedValue(null)
  })

  it("updates only a matching pre-reveal checkpoint version", async () => {
    const { service, tx } = makeDatabase()
    tx.practiceSessionItem.findFirst.mockResolvedValue(ownedCheckpointItem())
    tx.practiceResponseCheckpoint.updateMany.mockResolvedValue({ count: 1 })
    tx.practiceResponseCheckpoint.findFirst.mockResolvedValue(
      checkpoint({ phase: "DRAFTING", draftAnswer: "new answer", version: 3 }),
    )

    const result = await service.saveCheckpoint({
      userId: "user-a",
      itemId: "item-a",
      answer: "new answer",
      expectedVersion: 2,
    })

    expect(result).toEqual({
      phase: "DRAFTING",
      draftAnswer: "new answer",
      version: 3,
    })
    expect(tx.practiceResponseCheckpoint.updateMany).toHaveBeenCalledWith({
      where: {
        id: "checkpoint-a",
        userId: "user-a",
        version: 2,
        phase: { in: ["PROMPT", "DRAFTING"] },
      },
      data: {
        draftAnswer: "new answer",
        phase: "DRAFTING",
        version: { increment: 1 },
      },
    })
  })

  it("returns the latest durable checkpoint on an optimistic conflict", async () => {
    const { service, tx } = makeDatabase()
    tx.practiceSessionItem.findFirst.mockResolvedValue(ownedCheckpointItem())
    tx.practiceResponseCheckpoint.updateMany.mockResolvedValue({ count: 0 })
    tx.practiceResponseCheckpoint.findFirst.mockResolvedValue(
      checkpoint({ draftAnswer: "other tab", version: 4 }),
    )

    await expect(
      service.saveCheckpoint({
        userId: "user-a",
        itemId: "item-a",
        answer: "stale answer",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({
      code: "CHECKPOINT_VERSION_CONFLICT",
      status: 409,
      checkpoint: {
        phase: "DRAFTING",
        draftAnswer: "other tab",
        version: 4,
      },
    })
  })

  it("makes missing and foreign-owned practice items indistinguishable", async () => {
    const { service, tx } = makeDatabase()
    tx.practiceSessionItem.findFirst.mockResolvedValue(null)

    const error = await service
      .saveCheckpoint({
        userId: "user-b",
        itemId: "item-a",
        answer: "guess",
        expectedVersion: 0,
      })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(PracticeServiceError)
    expect(error).toMatchObject({ code: "PRACTICE_NOT_FOUND", status: 404 })
    expect(tx.practiceSessionItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-a", session: { userId: "user-b" } },
      }),
    )
    expect(tx.practiceResponseCheckpoint.updateMany).not.toHaveBeenCalled()
  })

  it("locks the exact answer before selecting and returning the reference", async () => {
    const { service, tx } = makeDatabase()
    const exactAnswer = "  cache entries can become stale  "
    tx.practiceSessionItem.findFirst
      .mockResolvedValueOnce(ownedCheckpointItem())
      .mockResolvedValueOnce({
        responseCheckpoint: {
          phase: "REVEALED",
          lockedAnswer: exactAnswer,
          version: 3,
          revealedAt: NOW,
        },
        questionRevision: {
          referenceAnswer: "Invalidate or version stale entries.",
          explanation: "Prefer explicit invalidation boundaries.",
        },
      })
    tx.practiceResponseCheckpoint.updateMany.mockResolvedValue({ count: 1 })

    const result = await service.reveal({
      userId: "user-a",
      itemId: "item-a",
      answer: exactAnswer,
      expectedVersion: 2,
    })

    expect(tx.practiceResponseCheckpoint.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draftAnswer: exactAnswer,
          lockedAnswer: exactAnswer,
          revealedAt: NOW,
          phase: "REVEALED",
        }),
      }),
    )
    expect(
      tx.practiceResponseCheckpoint.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.practiceSessionItem.findFirst.mock.invocationCallOrder[1])
    expect(result).toEqual({
      checkpoint: {
        phase: "REVEALED",
        lockedAnswer: exactAnswer,
        version: 3,
        revealedAt: NOW.toISOString(),
      },
      referenceAnswer: "Invalidate or version stale entries.",
      explanation: "Prefer explicit invalidation boundaries.",
    })
  })

  it.each([
    { answer: "1", objectiveCorrect: true },
    { answer: "2", objectiveCorrect: false },
  ])(
    "returns objective correctness for generated choice $answer",
    async ({ answer, objectiveCorrect }) => {
      const { service, tx } = makeDatabase()
      const generatedSpec = generatedMultipleChoiceSpec()
      tx.practiceSessionItem.findFirst
        .mockResolvedValueOnce(ownedGeneratedCheckpointItem())
        .mockResolvedValueOnce({
          responseCheckpoint: {
            phase: "REVEALED",
            lockedAnswer: answer,
            version: 3,
            revealedAt: NOW,
          },
          questionRevision: {
            referenceAnswer: "Version cache keys when invalidation is uncertain.",
            explanation: "A version bump makes old entries unreachable.",
          },
          question: { generatedSpec },
        })
      tx.practiceResponseCheckpoint.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.reveal({
        userId: "user-a",
        itemId: "item-a",
        answer,
        expectedVersion: 2,
      })

      expect(result).toMatchObject({
        checkpoint: { lockedAnswer: answer },
        objectiveCorrect,
      })
    },
  )

  it("rejects an invalid generated choice before locking the answer", async () => {
    const { service, tx } = makeDatabase()
    tx.practiceSessionItem.findFirst.mockResolvedValue(ownedGeneratedCheckpointItem())

    await expect(
      service.reveal({
        userId: "user-a",
        itemId: "item-a",
        answer: "4",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_PRACTICE_STATE",
      status: 409,
      message: "Choose an answer before checking it.",
    })
    expect(tx.practiceResponseCheckpoint.updateMany).not.toHaveBeenCalled()
  })

  it("atomically grades from server-owned state and rebuilds readiness", async () => {
    const { database, service, tx, transaction } = makeDatabase()
    database.attempt.findFirst.mockResolvedValue(null)
    tx.attempt.findFirst.mockResolvedValue(null)
    tx.practiceSessionItem.findFirst.mockResolvedValue(gradeItem())
    tx.reviewSchedule.findUnique.mockResolvedValue({
      id: "schedule-a",
      userId: "user-a",
      questionId: "question-a",
      questionRevisionId: "revision-a",
      dueAt: DUE_AT,
      intervalMinutes: 0,
      repetitions: 0,
      lapses: 0,
      lastReviewedAt: null,
      algorithmVersion: "schedule-v1",
      version: 0,
    })
    tx.masteryEvidence.findMany.mockResolvedValue([])
    tx.reviewSchedule.findMany.mockResolvedValue([
      {
        id: "schedule-a",
        dueAt: DUE_AT,
        intervalMinutes: 0,
        questionRevision: {
          concepts: [{ conceptVersionId: "concept-version-a" }],
        },
      },
    ])
    tx.practiceResponseCheckpoint.updateMany.mockResolvedValue({ count: 1 })
    tx.reviewSchedule.updateMany.mockResolvedValue({ count: 1 })
    tx.attempt.create.mockResolvedValue({ id: "attempt-a" })
    tx.masteryEvidence.create.mockResolvedValue({ id: "evidence-a" })
    tx.goalSkillReadiness.upsert.mockResolvedValue({ id: "readiness-a" })
    tx.practiceSessionItem.update.mockResolvedValue({ id: "item-a" })
    tx.practiceSession.update.mockResolvedValue({ id: "session-a" })
    tx.practiceResponseCheckpoint.delete.mockResolvedValue({ id: "checkpoint-a" })

    const summary = await service.grade({
      userId: "user-a",
      itemId: "item-a",
      rating: "GOOD",
      idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e",
      expectedVersion: 2,
    })

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(summary).toEqual({
      milestone: expect.objectContaining({ ruleVersion: "mastery-v1", requirements: expect.any(Array) }),
      skillTitle: "Cache invalidation",
      goalSkillId: "goal-skill-a",
      stageBefore: "UNASSESSED",
      stageAfter: "LEARNING",
      confidence: "LOW",
      rating: "GOOD",
      evidenceWeight: 0.5,
      timezone: "UTC",
      nextReviewAt: "2026-09-03T16:00:00.000Z",
      reason: "First recall saved.",
      dueState: "CURRENT",
      sessionComplete: true,
      completedCount: 1,
      totalCount: 1,
    })
    expect(tx.practiceResponseCheckpoint.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          phase: "REVEALED",
          version: 2,
        }),
        data: expect.objectContaining({
          phase: "SAVING",
          pendingRating: "GOOD",
        }),
      }),
    )
    expect(tx.reviewSchedule.updateMany).toHaveBeenCalledWith({
      where: {
        id: "schedule-a",
        userId: "user-a",
        version: 0,
        questionRevisionId: "revision-a",
      },
      data: {
        dueAt: new Date("2026-09-03T16:00:00.000Z"),
        intervalMinutes: 1440,
        repetitions: 1,
        lapses: 0,
        lastReviewedAt: NOW,
        version: 1,
      },
    })
    expect(tx.attempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lockedAnswer: "  my exact answer  ",
        rating: "GOOD",
        responseTimeMs: 30_000,
        evidenceStageBefore: "UNASSESSED",
        evidenceStageAfter: "LEARNING",
        confidenceBefore: "LOW",
        confidenceAfter: "LOW",
      }),
    })
    expect(tx.masteryEvidence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attemptId: "attempt-a",
        normalizedScore: 0.85,
        weight: 0.5,
        reviewDay: "2026-09-02",
        reviewTimezone: "UTC",
      }),
    })
    expect(tx.goalSkillReadiness.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ stage: "LEARNING", confidence: "LOW" }),
        update: expect.objectContaining({ stage: "LEARNING", confidence: "LOW" }),
      }),
    )
    expect(tx.practiceSessionItem.update).toHaveBeenCalledWith({
      where: { id: "item-a" },
      data: {
        status: "COMPLETED",
        completedAt: NOW,
        resultJson: JSON.stringify(summary),
      },
    })
    expect(tx.practiceSession.update).toHaveBeenCalledWith({
      where: { id: "session-a" },
      data: { status: "COMPLETED", completedAt: NOW },
    })
    expect(tx.practiceResponseCheckpoint.delete).toHaveBeenCalledWith({
      where: { id: "checkpoint-a" },
    })
  })

  it.each(["HARD", "GOOD", "EASY"] as const)(
    "does not allow an objectively wrong choice to be graded %s",
    async (rating) => {
      const context = makeDatabase()
      const { database, service, tx } = context
      database.attempt.findFirst.mockResolvedValue(null)
      tx.attempt.findFirst.mockResolvedValue(null)
      tx.practiceSessionItem.findFirst.mockResolvedValue(
        generatedGradeItem({ lockedAnswer: "2" }),
      )

      await expect(
        service.grade({
          userId: "user-a",
          itemId: "item-a",
          rating,
          idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e",
          expectedVersion: 2,
        }),
      ).rejects.toMatchObject({
        code: "INVALID_PRACTICE_STATE",
        status: 409,
        message: "An incorrect answer must be saved as Missed.",
      })
      expect(tx.reviewSchedule.findUnique).not.toHaveBeenCalled()
      expect(tx.practiceResponseCheckpoint.updateMany).not.toHaveBeenCalled()
      expect(tx.masteryEvidence.create).not.toHaveBeenCalled()
    },
  )

  it("allows an objectively wrong choice to be graded AGAIN", async () => {
    const context = makeDatabase()
    const { service, tx } = context
    prepareSuccessfulGrade(context, generatedGradeItem({ lockedAnswer: "2" }))

    const summary = await service.grade({
      userId: "user-a",
      itemId: "item-a",
      rating: "AGAIN",
      idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e",
      expectedVersion: 2,
    })

    expect(summary).toMatchObject({
      rating: "AGAIN",
      objectiveCorrect: false,
      gapId: "gap-a",
    })
    expect(
      remediationMocks.createOrReopenRecallGapInTransaction,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: "user-a",
        goalSkillId: "goal-skill-a",
        conceptVersionId: "concept-version-a",
        questionId: "question-a",
        questionRevisionId: "revision-a",
        attemptId: "attempt-a",
      }),
    )
    expect(tx.masteryEvidence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "OBJECTIVE_RECALL",
        normalizedScore: 0,
      }),
    })
  })

  it("turns a correct-but-guessed generated answer into a cited gap", async () => {
    const context = makeDatabase()
    const { service } = context
    prepareSuccessfulGrade(context, generatedGradeItem({ lockedAnswer: "1" }))

    const summary = await service.grade({
      userId: "user-a",
      itemId: "item-a",
      rating: "AGAIN",
      idempotencyKey: "255d2e4c-bca1-4b6c-b0b5-49f7e8ec0fe3",
      expectedVersion: 2,
    })

    expect(summary).toMatchObject({
      objectiveCorrect: true,
      rating: "AGAIN",
      gapId: "gap-a",
    })
    expect(
      remediationMocks.createOrReopenRecallGapInTransaction,
    ).toHaveBeenCalledOnce()
  })

  it("opens a cited gap for a generated short response rated Missed", async () => {
    const context = makeDatabase()
    const { service } = context
    prepareSuccessfulGrade(context, generatedShortResponseGradeItem())

    const summary = await service.grade({
      userId: "user-a",
      itemId: "item-a",
      rating: "AGAIN",
      idempotencyKey: "844942fd-572b-4e0a-9222-1056153dcbf1",
      expectedVersion: 2,
    })

    expect(summary).toMatchObject({ rating: "AGAIN", gapId: "gap-a" })
    expect(
      remediationMocks.createOrReopenRecallGapInTransaction,
    ).toHaveBeenCalledWith(
      context.tx,
      expect.objectContaining({
        content: expect.objectContaining({
          gapLabel: "Cache versioning",
          sourceVersionId: "source-version-a",
          citationLocator: "Cache notes · paragraph 2",
        }),
      }),
    )
  })

  it("returns a resolved gap after a later successful recall", async () => {
    const context = makeDatabase()
    const { service } = context
    prepareSuccessfulGrade(context, generatedGradeItem({ lockedAnswer: "1" }))
    remediationMocks.resolveLearningGapFromRecallInTransaction.mockResolvedValue({
      gapId: "gap-a",
      resolved: true,
      alreadyResolved: false,
    })

    const summary = await service.grade({
      userId: "user-a",
      itemId: "item-a",
      rating: "GOOD",
      idempotencyKey: "dbf309d2-ea03-413f-a609-59670923e70e",
      expectedVersion: 2,
    })

    expect(summary).toMatchObject({ rating: "GOOD", resolvedGapId: "gap-a" })
    expect(
      remediationMocks.resolveLearningGapFromRecallInTransaction,
    ).toHaveBeenCalledWith(
      context.tx,
      expect.objectContaining({
        userId: "user-a",
        goalSkillId: "goal-skill-a",
        conceptVersionId: "concept-version-a",
        attemptId: "attempt-a",
      }),
    )
    expect(
      remediationMocks.createOrReopenRecallGapInTransaction,
    ).not.toHaveBeenCalled()
  })

  it("records generated transfer metadata, evidence kind, and question family", async () => {
    const context = makeDatabase()
    const { service, tx } = context
    prepareSuccessfulGrade(
      context,
      generatedGradeItem({
        lockedAnswer: "1",
        role: "TRANSFER",
        questionFamilyId: "cache-transfer-family",
      }),
    )

    const summary = await service.grade({
      userId: "user-a",
      itemId: "item-a",
      rating: "GOOD",
      idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e",
      expectedVersion: 2,
    })

    expect(summary).toMatchObject({
      objectiveCorrect: true,
      isTransfer: true,
    })
    expect(tx.masteryEvidence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "OBJECTIVE_TRANSFER" }),
    })
    expect(tx.goalSkillReadiness.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          successfulTransferProbes: 1,
          transferReviewDays: 1,
        }),
      }),
    )
  })

  it("stops the grade transaction if the schedule loses its optimistic race", async () => {
    const { database, service, tx } = makeDatabase()
    database.attempt.findFirst.mockResolvedValue(null)
    tx.attempt.findFirst.mockResolvedValue(null)
    tx.practiceSessionItem.findFirst.mockResolvedValue(gradeItem())
    tx.reviewSchedule.findUnique.mockResolvedValue({
      id: "schedule-a",
      questionRevisionId: "revision-a",
      dueAt: DUE_AT,
      intervalMinutes: 0,
      repetitions: 0,
      lapses: 0,
      lastReviewedAt: null,
      algorithmVersion: "schedule-v1",
      version: 0,
    })
    tx.masteryEvidence.findMany.mockResolvedValue([])
    tx.reviewSchedule.findMany.mockResolvedValue([
      {
        id: "schedule-a",
        dueAt: DUE_AT,
        intervalMinutes: 0,
        questionRevision: {
          concepts: [{ conceptVersionId: "concept-version-a" }],
        },
      },
    ])
    tx.practiceResponseCheckpoint.updateMany.mockResolvedValue({ count: 1 })
    tx.reviewSchedule.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      service.grade({
        userId: "user-a",
        itemId: "item-a",
        rating: "GOOD",
        idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "SCHEDULE_VERSION_CONFLICT", status: 409 })
    expect(tx.attempt.create).not.toHaveBeenCalled()
    expect(tx.masteryEvidence.create).not.toHaveBeenCalled()
    expect(tx.goalSkillReadiness.upsert).not.toHaveBeenCalled()
  })

  it("returns the same stored result for an idempotent grade retry", async () => {
    const { database, service, transaction } = makeDatabase()
    const storedSummary: PracticeSummary = {
      skillTitle: "Cache invalidation",
      stageBefore: "UNASSESSED",
      stageAfter: "LEARNING",
      confidence: "LOW",
      nextReviewAt: "2026-09-03T16:00:00.000Z",
      reason: "First recall saved.",
      dueState: "CURRENT",
    }
    database.attempt.findFirst.mockResolvedValue({
      sessionItemId: "item-a",
      sessionItem: { resultJson: JSON.stringify(storedSummary) },
    })

    const result = await service.grade({
      userId: "user-a",
      itemId: "item-a",
      rating: "AGAIN",
      idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e",
      expectedVersion: 999,
    })

    expect(result).toEqual(storedSummary)
    expect(transaction).not.toHaveBeenCalled()
    expect(
      remediationMocks.createOrReopenRecallGapInTransaction,
    ).not.toHaveBeenCalled()
    expect(
      remediationMocks.resolveLearningGapFromRecallInTransaction,
    ).not.toHaveBeenCalled()
  })

  it("checks item ownership before an idempotency key can affect the response", async () => {
    const { database, service, transaction } = makeDatabase()
    database.practiceSessionItem.findFirst.mockResolvedValue(null)
    database.attempt.findFirst.mockResolvedValue({
      sessionItemId: "item-other",
      sessionItem: { resultJson: "{}" },
    })

    await expect(
      service.grade({
        userId: "user-a",
        itemId: "foreign-item",
        rating: "GOOD",
        idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "PRACTICE_NOT_FOUND", status: 404 })
    expect(database.attempt.findFirst).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it("rejects reuse of a grade key for another owned item", async () => {
    const { database, service, transaction } = makeDatabase()
    database.attempt.findFirst.mockResolvedValue({
      sessionItemId: "item-other",
      sessionItem: { resultJson: "{}" },
    })

    await expect(
      service.grade({
        userId: "user-a",
        itemId: "item-a",
        rating: "GOOD",
        idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED", status: 409 })
    expect(transaction).not.toHaveBeenCalled()
  })
})
