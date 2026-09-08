import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import {
  createInitialQuizGapInTransaction,
  createOrReopenRecallGapInTransaction,
  createRemediationService,
  LearningGapNotFoundError,
  resolveLearningGapFromRecallInTransaction,
  StaleRemediationRevisionError,
  type RemediationContent,
} from "@/lib/learning/remediation-service"

const content: RemediationContent = {
  sourceVersionId: "source-version-1",
  gapLabel: "Collision handling",
  recommendedAction: "Explain collision handling, then apply it once.",
  explanation: "Two keys can resolve to the same bucket.",
  workedExample: null,
  scaffoldPrompt: "Explain why a collision strategy is necessary.",
  scaffoldAnswer: "A strategy preserves both values when keys share a bucket.",
  citationLocator: "Hash map notes · snapshot 1",
  citationExcerpt: "Collisions occur when keys resolve to the same bucket.",
}

const location = {
  userId: "user-1",
  goalSkillId: "goal-skill-1",
  conceptVersionId: "concept-version-1",
  questionId: "question-1",
  questionRevisionId: "question-revision-1",
  openedAt: new Date("2026-09-06T12:00:00.000Z"),
  openedReviewDay: "2026-09-06",
  content,
}

function transaction() {
  return {
    learningGap: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    remediationRevision: {
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    remediationActivity: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    attempt: { findFirst: vi.fn() },
    masteryEvidence: { create: vi.fn() },
  }
}

describe("durable learning-gap remediation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates one competency gap and an immutable source-cited revision", async () => {
    const tx = transaction()
    tx.learningGap.findUnique.mockResolvedValue(null)
    tx.remediationRevision.findUnique.mockResolvedValue(null)
    tx.remediationRevision.aggregate.mockResolvedValue({ _max: { revision: null } })
    tx.remediationRevision.create.mockResolvedValue({ id: "remediation-1" })

    const result = await createInitialQuizGapInTransaction(tx as never, {
      ...location,
      learningPackAttemptId: "pack-attempt-1",
    })

    expect(result).toMatchObject({
      remediationRevisionId: "remediation-1",
      created: true,
      reopened: false,
      alreadyRecorded: false,
    })
    expect(tx.learningGap.findUnique).toHaveBeenCalledWith({
      where: {
        userId_goalSkillId_conceptVersionId: {
          userId: "user-1",
          goalSkillId: "goal-skill-1",
          conceptVersionId: "concept-version-1",
        },
      },
      select: {
        id: true,
        status: true,
        initialLearningPackAttemptId: true,
      },
    })
    expect(tx.learningGap.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        goalSkillId: "goal-skill-1",
        conceptVersionId: "concept-version-1",
        questionId: "question-1",
        initialLearningPackAttemptId: "pack-attempt-1",
        status: "OPEN",
      }),
    })
    expect(tx.remediationRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        revision: 1,
        triggerKind: "INITIAL_QUIZ",
        triggerKey: "pack-attempt-1",
        sourceVersionId: "source-version-1",
        citationLocator: "Hash map notes · snapshot 1",
        citationExcerpt: "Collisions occur when keys resolve to the same bucket.",
      }),
      select: { id: true },
    })
  })

  it("records the same recall miss once and does not reopen it on a retry", async () => {
    const tx = transaction()
    tx.learningGap.findUnique.mockResolvedValue({
      id: "gap-1",
      status: "RESOLVED",
      initialLearningPackAttemptId: "pack-attempt-1",
    })
    tx.remediationRevision.findUnique.mockResolvedValue({ id: "remediation-2" })

    const result = await createOrReopenRecallGapInTransaction(tx as never, {
      ...location,
      attemptId: "recall-attempt-2",
    })

    expect(result).toEqual({
      gapId: "gap-1",
      remediationRevisionId: "remediation-2",
      created: false,
      reopened: false,
      alreadyRecorded: true,
    })
    expect(tx.learningGap.update).not.toHaveBeenCalled()
    expect(tx.remediationRevision.create).not.toHaveBeenCalled()
  })

  it("reopens a competency on a new recall miss and versions its remediation", async () => {
    const tx = transaction()
    tx.learningGap.findUnique.mockResolvedValue({
      id: "gap-1",
      status: "RESOLVED",
      initialLearningPackAttemptId: "pack-attempt-1",
    })
    tx.remediationRevision.findUnique.mockResolvedValue(null)
    tx.remediationRevision.aggregate.mockResolvedValue({ _max: { revision: 1 } })
    tx.remediationRevision.create.mockResolvedValue({ id: "remediation-2" })

    const result = await createOrReopenRecallGapInTransaction(tx as never, {
      ...location,
      questionId: "question-variant-2",
      questionRevisionId: "question-variant-revision-2",
      attemptId: "recall-attempt-2",
    })

    expect(result).toMatchObject({
      gapId: "gap-1",
      remediationRevisionId: "remediation-2",
      created: false,
      reopened: true,
    })
    expect(tx.learningGap.update).toHaveBeenCalledWith({
      where: { id: "gap-1" },
      data: expect.objectContaining({
        questionId: "question-variant-2",
        latestRecallAttemptId: "recall-attempt-2",
        status: "OPEN",
        resolvedAt: null,
        resolvedByAttemptId: null,
      }),
    })
    expect(tx.remediationRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ revision: 2, triggerKind: "RECALL" }),
      select: { id: true },
    })
  })

  it("resolves an initial gap from a later successful variant recall", async () => {
    const tx = transaction()
    tx.learningGap.findUnique.mockResolvedValue({
      id: "gap-1",
      status: "OPEN",
      openedAt: new Date("2026-09-06T12:00:00.000Z"),
      latestRecallAttemptId: null,
      resolvedByAttemptId: null,
    })
    tx.attempt.findFirst.mockResolvedValue({ id: "successful-attempt" })
    tx.learningGap.updateMany.mockResolvedValue({ count: 1 })

    const result = await resolveLearningGapFromRecallInTransaction(tx as never, {
      userId: "user-1",
      goalSkillId: "goal-skill-1",
      conceptVersionId: "concept-version-1",
      attemptId: "successful-attempt",
      resolvedAt: new Date("2026-09-06T12:10:00.000Z"),
    })

    expect(result).toEqual({
      gapId: "gap-1",
      resolved: true,
      alreadyResolved: false,
    })
    expect(tx.attempt.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "successful-attempt",
        rating: { in: ["HARD", "GOOD", "EASY"] },
        masteryEvidence: { some: { conceptVersionId: "concept-version-1" } },
      }),
      select: { id: true },
    })
    expect(tx.learningGap.updateMany).toHaveBeenCalledWith({
      where: expect.not.objectContaining({ latestRecallAttemptId: expect.anything() }),
      data: {
        status: "RESOLVED",
        resolvedAt: new Date("2026-09-06T12:10:00.000Z"),
        resolvedByAttemptId: "successful-attempt",
      },
    })
  })

  it("does not let the triggering attempt resolve its own gap", async () => {
    const tx = transaction()
    tx.learningGap.findUnique.mockResolvedValue({
      id: "gap-1",
      status: "OPEN",
      openedAt: new Date("2026-09-06T12:00:00.000Z"),
      latestRecallAttemptId: "trigger-attempt",
      resolvedByAttemptId: null,
    })

    const result = await resolveLearningGapFromRecallInTransaction(tx as never, {
      userId: "user-1",
      goalSkillId: "goal-skill-1",
      conceptVersionId: "concept-version-1",
      attemptId: "trigger-attempt",
      resolvedAt: new Date("2026-09-06T12:10:00.000Z"),
    })

    expect(result).toBeNull()
    expect(tx.attempt.findFirst).not.toHaveBeenCalled()
    expect(tx.learningGap.updateMany).not.toHaveBeenCalled()
  })

  it("saves one idempotent scaffold activity without mastery evidence", async () => {
    const tx = transaction()
    tx.learningGap.findFirst.mockResolvedValue({
      id: "gap-1",
      remediationRevisions: [{ id: "remediation-1" }],
    })
    tx.remediationActivity.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ completedAt: new Date("2026-09-06T12:20:00.000Z") })
    tx.remediationActivity.create.mockResolvedValue({
      completedAt: new Date("2026-09-06T12:20:00.000Z"),
    })
    const database = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    }
    const service = createRemediationService(
      database as never,
      () => new Date("2026-09-06T12:20:00.000Z"),
    )

    const input = {
      userId: "user-1",
      goalSkillId: "goal-skill-1",
      gapId: "gap-1",
      remediationRevisionId: "remediation-1",
      answer: "A collision strategy preserves both values.",
    }
    const first = await service.completeRemediation(input)
    const retry = await service.completeRemediation(input)

    expect(first.alreadyCompleted).toBe(false)
    expect(retry.alreadyCompleted).toBe(true)
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    })
    expect(tx.learningGap.findFirst).toHaveBeenCalledWith({
      where: {
        id: "gap-1",
        userId: "user-1",
        goalSkillId: "goal-skill-1",
        remediationRevisions: { some: { id: "remediation-1" } },
      },
      select: {
        id: true,
        remediationRevisions: {
          orderBy: { revision: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    })
    expect(tx.remediationActivity.create).toHaveBeenCalledTimes(1)
    expect(tx.remediationActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        learningGapId: "gap-1",
        remediationRevisionId: "remediation-1",
      }),
      select: { completedAt: true },
    })
    expect(tx.masteryEvidence.create).not.toHaveBeenCalled()
  })

  it("rejects a displayed revision that is no longer the latest", async () => {
    const tx = transaction()
    tx.learningGap.findFirst.mockResolvedValue({
      id: "gap-1",
      remediationRevisions: [{ id: "remediation-2" }],
    })
    const database = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    }
    const service = createRemediationService(database as never)

    const staleError = await service
      .completeRemediation({
        userId: "user-1",
        goalSkillId: "goal-skill-1",
        gapId: "gap-1",
        remediationRevisionId: "remediation-1",
        answer: "An answer to an older scaffold.",
      })
      .catch((error: unknown) => error)

    expect(staleError).toBeInstanceOf(StaleRemediationRevisionError)
    expect(staleError).toMatchObject({
      name: "StaleRemediationRevisionError",
      code: "STALE_REMEDIATION_REVISION",
      message: "This practice changed. Reload to continue.",
    })
    expect(tx.remediationActivity.findUnique).not.toHaveBeenCalled()
    expect(tx.remediationActivity.create).not.toHaveBeenCalled()
  })

  it("fails closed when the submitted revision does not belong to the owned gap", async () => {
    const tx = transaction()
    tx.learningGap.findFirst.mockResolvedValue(null)
    const database = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    }
    const service = createRemediationService(database as never)

    await expect(
      service.completeRemediation({
        userId: "user-1",
        goalSkillId: "goal-skill-1",
        gapId: "gap-1",
        remediationRevisionId: "revision-from-another-gap",
        answer: "This must not be stored.",
      }),
    ).rejects.toBeInstanceOf(LearningGapNotFoundError)
    expect(tx.remediationActivity.create).not.toHaveBeenCalled()
  })

  it("fails closed when a gap is not owned by the caller", async () => {
    const database = { learningGap: { findFirst: vi.fn().mockResolvedValue(null) } }
    const service = createRemediationService(database as never)

    await expect(
      service.getOwnedLearningGap("other-user", "goal-skill-1", "gap-1"),
    ).rejects.toBeInstanceOf(LearningGapNotFoundError)
  })
})
