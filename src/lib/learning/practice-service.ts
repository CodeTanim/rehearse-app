import { Prisma, type PrismaClient } from "@prisma/client"

import {
  getEvidenceWeight,
  MASTERY_RULE_VERSION,
  projectGoalSkillReadiness,
} from "@/lib/learning/mastery"
import { toReviewDay } from "@/lib/learning/review-day"
import {
  deriveDueState,
  getRatingScore,
  scheduleNextReview,
} from "@/lib/learning/schedule"
import {
  createOrReopenRecallGapInTransaction,
  resolveLearningGapFromRecallInTransaction,
  type RemediationContent,
} from "@/lib/learning/remediation-service"
import type {
  ActiveConceptSchedule,
  EvidenceConfidence,
  EvidenceStage,
  GoalSkillReadinessResult,
  MasteryEvidenceInput,
  ReviewRating,
} from "@/lib/learning/types"
import { prisma } from "@/lib/prisma"

type Transaction = Prisma.TransactionClient

const PRE_REVEAL_PHASES = ["PROMPT", "DRAFTING"] as const
const MAX_RESPONSE_TIME_MS = 2_147_483_647

export type PracticeCheckpointSnapshot = {
  phase: string
  draftAnswer?: string
  lockedAnswer?: string
  version: number
  revealedAt?: string
}

export type PracticeSummary = {
  skillTitle: string
  goalSkillId?: string
  stageBefore: EvidenceStage
  stageAfter: EvidenceStage
  confidence: EvidenceConfidence
  rating?: ReviewRating
  evidenceWeight?: number
  timezone?: string
  nextReviewAt: string
  reason: string
  dueState: "CURRENT" | "DUE" | "OVERDUE"
  sessionComplete?: boolean
  completedCount?: number
  totalCount?: number
  objectiveCorrect?: boolean
  isTransfer?: boolean
  gapId?: string
  resolvedGapId?: string
}

type PracticeErrorCode =
  | "PRACTICE_NOT_FOUND"
  | "CHECKPOINT_VERSION_CONFLICT"
  | "INVALID_PRACTICE_STATE"
  | "IDEMPOTENCY_KEY_REUSED"
  | "SCHEDULE_VERSION_CONFLICT"

export class PracticeServiceError extends Error {
  constructor(
    message: string,
    readonly code: PracticeErrorCode,
    readonly status: 404 | 409,
    readonly checkpoint?: PracticeCheckpointSnapshot,
  ) {
    super(message)
    this.name = "PracticeServiceError"
  }
}

type Clock = () => Date

function copyServerTime(clock: Clock) {
  const now = clock()
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new RangeError("The practice clock must return a valid Date.")
  }
  return new Date(now)
}

function notFound() {
  return new PracticeServiceError(
    "Practice item not found.",
    "PRACTICE_NOT_FOUND",
    404,
  )
}

function invalidState(message: string) {
  return new PracticeServiceError(message, "INVALID_PRACTICE_STATE", 409)
}

function checkpointSnapshot(checkpoint: {
  phase: string
  draftAnswer: string
  lockedAnswer: string | null
  version: number
  revealedAt: Date | null
}): PracticeCheckpointSnapshot {
  if (checkpoint.phase === "REVEALED" || checkpoint.phase === "SAVING") {
    return {
      phase: checkpoint.phase,
      lockedAnswer: checkpoint.lockedAnswer ?? "",
      version: checkpoint.version,
      ...(checkpoint.revealedAt
        ? { revealedAt: checkpoint.revealedAt.toISOString() }
        : {}),
    }
  }

  return {
    phase: checkpoint.phase,
    draftAnswer: checkpoint.draftAnswer,
    version: checkpoint.version,
  }
}

function checkpointConflict(checkpoint: Parameters<typeof checkpointSnapshot>[0]) {
  return new PracticeServiceError(
    "This answer changed in another tab. Your latest saved answer is shown.",
    "CHECKPOINT_VERSION_CONFLICT",
    409,
    checkpointSnapshot(checkpoint),
  )
}

function parseStoredSummary(value: string | null): PracticeSummary | null {
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== "object") return null
    const candidate = parsed as Partial<PracticeSummary>
    if (
      typeof candidate.skillTitle !== "string" ||
      typeof candidate.stageBefore !== "string" ||
      typeof candidate.stageAfter !== "string" ||
      typeof candidate.confidence !== "string" ||
      typeof candidate.nextReviewAt !== "string" ||
      typeof candidate.reason !== "string" ||
      typeof candidate.dueState !== "string"
    ) {
      return null
    }
    return candidate as PracticeSummary
  } catch {
    return null
  }
}

function reasonFor(readiness: GoalSkillReadinessResult) {
  const reasons = new Set(readiness.explanation.reasons)
  if (reasons.has("WELL_LEARNED_REQUIREMENTS_MET")) {
    return "Well learned for this goal."
  }
  if (reasons.has("DEMONSTRATED_REQUIREMENTS_MET")) {
    return "Recall demonstrated across days."
  }
  if (reasons.has("FIRST_REVIEW_RECORDED")) return "First recall saved."
  if (reasons.has("LATEST_REVIEW_WAS_AGAIN")) return "A quick refresh is scheduled."
  if (reasons.has("NEEDS_REVIEW_DAYS")) return "Keep practicing across a few days."
  return "Review saved."
}

function readinessData(readiness: GoalSkillReadinessResult) {
  return {
    ruleVersion: readiness.ruleVersion,
    stage: readiness.stage,
    confidence: readiness.confidence,
    scopeCoverage: readiness.scopeCoverage,
    selfAssessedIndex: readiness.selfAssessedIndex,
    recentThreeSessionIndex: readiness.recentThreeSessionIndex,
    fullWeightReviews: readiness.fullWeightReviews,
    successfulFullWeightReviews: readiness.successfulFullWeightReviews,
    distinctReviewDays: readiness.distinctReviewDays,
    spanDays: readiness.spanDays,
    completedSessions: readiness.completedSessions,
    successfulTransferProbes: readiness.successfulTransferProbes,
    transferReviewDays: readiness.transferReviewDays,
    latestRating: readiness.latestRating,
    earliestDueAt: readiness.earliestDueAt,
    explanationJson: JSON.stringify(readiness.explanation),
    computedAt: readiness.computedAt,
  }
}

async function findLatestCheckpoint(
  transaction: Transaction,
  userId: string,
  itemId: string,
) {
  return transaction.practiceResponseCheckpoint.findFirst({
    where: {
      userId,
      sessionItemId: itemId,
      sessionItem: { session: { userId } },
    },
    select: {
      id: true,
      phase: true,
      draftAnswer: true,
      lockedAnswer: true,
      version: true,
      revealedAt: true,
    },
  })
}

async function requireOwnedCheckpoint(
  transaction: Transaction,
  userId: string,
  itemId: string,
) {
  const item = await transaction.practiceSessionItem.findFirst({
    where: { id: itemId, session: { userId } },
    select: {
      id: true,
      status: true,
      session: { select: { status: true } },
      question: {
        select: {
          generatedSpec: {
            select: {
              responseType: true,
              choicesJson: true,
              correctChoiceIndex: true,
              role: true,
            },
          },
        },
      },
      responseCheckpoint: {
        select: {
          id: true,
          phase: true,
          draftAnswer: true,
          lockedAnswer: true,
          version: true,
          revealedAt: true,
        },
      },
    },
  })

  if (!item) throw notFound()
  if (!item.responseCheckpoint) {
    throw invalidState("This review has already been completed.")
  }
  if (item.status !== "PRESENTED" || item.session.status !== "ACTIVE") {
    throw invalidState("This review is no longer active.")
  }
  return {
    ...item.responseCheckpoint,
    generatedSpec: item.question?.generatedSpec ?? null,
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  )
}

function parseGeneratedChoices(value: string): string[] {
  try {
    const choices: unknown = JSON.parse(value)
    if (
      Array.isArray(choices) &&
      choices.length === 4 &&
      choices.every((choice) => typeof choice === "string" && choice.trim().length > 0)
    ) {
      return choices
    }
  } catch {
    // Fall through to the invariant error below.
  }
  throw invalidState("This generated question has invalid answer choices.")
}

function recallRemediationContent(input: {
  competencyTitle: string
  responseType: string
  referenceAnswer: string
  explanation: string | null
  sourceVersionId: string
  citationLocator: string
  citationExcerpt: string
}): RemediationContent {
  const label = input.competencyTitle.trim() || "This idea"
  const explanation =
    input.explanation?.split("\n\nSource:", 1)[0]?.trim() || input.referenceAnswer

  return {
    sourceVersionId: input.sourceVersionId,
    gapLabel: label,
    recommendedAction: `Review ${label}, then explain it once without looking.`,
    explanation: explanation.slice(0, 2_000),
    workedExample: input.referenceAnswer.slice(0, 2_000),
    scaffoldPrompt:
      input.responseType === "MULTIPLE_CHOICE"
        ? "Explain why the correct answer is supported by the source."
        : `Explain the key idea behind ${label} in your own words.`,
    scaffoldAnswer: input.referenceAnswer.slice(0, 2_000),
    citationLocator: input.citationLocator,
    citationExcerpt: input.citationExcerpt,
  }
}

function selectedChoice(answer: string, choiceCount: number): number | null {
  if (!/^\d+$/.test(answer)) return null
  const selected = Number(answer)
  return Number.isInteger(selected) && selected >= 0 && selected < choiceCount
    ? selected
    : null
}

async function recoverIdempotentGrade(
  database: PrismaClient,
  userId: string,
  itemId: string,
  idempotencyKey: string,
) {
  const existing = await database.attempt.findFirst({
    where: { userId, idempotencyKey },
    select: {
      sessionItemId: true,
      sessionItem: { select: { resultJson: true } },
    },
  })

  if (!existing) return null
  if (existing.sessionItemId !== itemId) {
    throw new PracticeServiceError(
      "That save key was already used for another review.",
      "IDEMPOTENCY_KEY_REUSED",
      409,
    )
  }

  const summary = parseStoredSummary(existing.sessionItem.resultJson)
  if (!summary) {
    throw invalidState("The saved review result could not be restored.")
  }
  return summary
}

export function createPracticeService(database: PrismaClient, clock: Clock = () => new Date()) {
  return {
    async saveCheckpoint(input: {
      userId: string
      itemId: string
      answer: string
      expectedVersion: number
    }) {
      return database.$transaction(async (transaction) => {
        const checkpoint = await requireOwnedCheckpoint(
          transaction,
          input.userId,
          input.itemId,
        )

        const update = await transaction.practiceResponseCheckpoint.updateMany({
          where: {
            id: checkpoint.id,
            userId: input.userId,
            version: input.expectedVersion,
            phase: { in: [...PRE_REVEAL_PHASES] },
          },
          data: {
            draftAnswer: input.answer,
            phase: input.answer.length === 0 ? "PROMPT" : "DRAFTING",
            version: { increment: 1 },
          },
        })

        if (update.count !== 1) {
          const latest = await findLatestCheckpoint(transaction, input.userId, input.itemId)
          if (!latest) throw invalidState("This review has already been completed.")
          throw checkpointConflict(latest)
        }

        const saved = await findLatestCheckpoint(transaction, input.userId, input.itemId)
        if (!saved) throw invalidState("The answer could not be restored after saving.")

        return {
          phase: saved.phase,
          draftAnswer: saved.draftAnswer,
          version: saved.version,
        }
      })
    },

    async reveal(input: {
      userId: string
      itemId: string
      answer: string
      expectedVersion: number
    }) {
      if (input.answer.trim().length === 0 || input.answer.length > 10_000) {
        throw invalidState("Write an answer before revealing the reference.")
      }
      const revealedAt = copyServerTime(clock)

      return database.$transaction(async (transaction) => {
        const checkpoint = await requireOwnedCheckpoint(
          transaction,
          input.userId,
          input.itemId,
        )
        if (checkpoint.generatedSpec?.responseType === "MULTIPLE_CHOICE") {
          const choices = parseGeneratedChoices(checkpoint.generatedSpec.choicesJson)
          if (selectedChoice(input.answer, choices.length) === null) {
            throw invalidState("Choose an answer before checking it.")
          }
        }
        const update = await transaction.practiceResponseCheckpoint.updateMany({
          where: {
            id: checkpoint.id,
            userId: input.userId,
            version: input.expectedVersion,
            phase: { in: [...PRE_REVEAL_PHASES] },
          },
          data: {
            draftAnswer: input.answer,
            lockedAnswer: input.answer,
            revealedAt,
            phase: "REVEALED",
            version: { increment: 1 },
          },
        })

        if (update.count !== 1) {
          const latest = await findLatestCheckpoint(transaction, input.userId, input.itemId)
          if (!latest) throw invalidState("This review has already been completed.")
          throw checkpointConflict(latest)
        }

        const revealed = await transaction.practiceSessionItem.findFirst({
          where: { id: input.itemId, session: { userId: input.userId } },
          select: {
            responseCheckpoint: {
              select: {
                phase: true,
                lockedAnswer: true,
                version: true,
                revealedAt: true,
              },
            },
            questionRevision: {
              select: { referenceAnswer: true, explanation: true },
            },
            question: {
              select: {
                generatedSpec: {
                  select: {
                    responseType: true,
                    choicesJson: true,
                    correctChoiceIndex: true,
                    role: true,
                  },
                },
              },
            },
          },
        })
        if (
          !revealed?.responseCheckpoint?.lockedAnswer ||
          !revealed.responseCheckpoint.revealedAt
        ) {
          throw invalidState("The answer could not be locked before reveal.")
        }

        const generatedSpec = revealed.question?.generatedSpec ?? null
        const choices = generatedSpec?.responseType === "MULTIPLE_CHOICE"
          ? parseGeneratedChoices(generatedSpec.choicesJson)
          : null
        const choice = choices
          ? selectedChoice(revealed.responseCheckpoint.lockedAnswer, choices.length)
          : null
        const correctChoiceIndex = generatedSpec?.correctChoiceIndex
        const objectiveCorrect =
          choice === null || correctChoiceIndex === null || correctChoiceIndex === undefined
            ? undefined
            : choice === correctChoiceIndex

        return {
          checkpoint: {
            phase: revealed.responseCheckpoint.phase,
            lockedAnswer: revealed.responseCheckpoint.lockedAnswer,
            version: revealed.responseCheckpoint.version,
            revealedAt: revealed.responseCheckpoint.revealedAt.toISOString(),
          },
          referenceAnswer: revealed.questionRevision.referenceAnswer,
          ...(revealed.questionRevision.explanation
            ? { explanation: revealed.questionRevision.explanation }
            : {}),
          ...(objectiveCorrect === undefined ? {} : { objectiveCorrect }),
          ...(generatedSpec?.role === "TRANSFER" ? { isTransfer: true } : {}),
        }
      })
    },

    async grade(input: {
      userId: string
      itemId: string
      rating: ReviewRating
      idempotencyKey: string
      expectedVersion: number
    }): Promise<PracticeSummary> {
      // Resolve the requested resource in the tenant before considering an
      // idempotency key. A guessed foreign ID must look exactly like a missing
      // ID, even when the caller happens to reuse one of their own save keys.
      const ownedItem = await database.practiceSessionItem.findFirst({
        where: { id: input.itemId, session: { userId: input.userId } },
        select: { id: true },
      })
      if (!ownedItem) throw notFound()

      const retry = await recoverIdempotentGrade(
        database,
        input.userId,
        input.itemId,
        input.idempotencyKey,
      )
      if (retry) return retry

      try {
        return await database.$transaction(async (transaction) => {
          const duplicate = await transaction.attempt.findFirst({
            where: { userId: input.userId, idempotencyKey: input.idempotencyKey },
            select: {
              sessionItemId: true,
              sessionItem: { select: { resultJson: true } },
            },
          })
          if (duplicate) {
            if (duplicate.sessionItemId !== input.itemId) {
              throw new PracticeServiceError(
                "That save key was already used for another review.",
                "IDEMPOTENCY_KEY_REUSED",
                409,
              )
            }
            const summary = parseStoredSummary(duplicate.sessionItem.resultJson)
            if (!summary) throw invalidState("The saved review result could not be restored.")
            return summary
          }

          const item = await transaction.practiceSessionItem.findFirst({
            where: { id: input.itemId, session: { userId: input.userId } },
            select: {
              id: true,
              status: true,
              questionId: true,
              questionRevisionId: true,
              scheduleDueAtBefore: true,
              intervalMinutesBefore: true,
              repetitionsBefore: true,
              lapsesBefore: true,
              scheduleAlgorithmVersion: true,
              presentedAt: true,
              attempt: { select: { id: true } },
              responseCheckpoint: {
                select: {
                  id: true,
                  phase: true,
                  draftAnswer: true,
                  lockedAnswer: true,
                  version: true,
                  revealedAt: true,
                },
              },
              question: {
                select: {
                  userId: true,
                  state: true,
                  schedulingEligible: true,
                  skillNodeId: true,
                  generatedSpec: {
                    select: {
                      responseType: true,
                      choicesJson: true,
                      correctChoiceIndex: true,
                      role: true,
                      questionFamilyId: true,
                      sourceVersionId: true,
                      citationLocator: true,
                      citationExcerpt: true,
                    },
                  },
                },
              },
              questionRevision: {
                select: {
                  questionId: true,
                  referenceAnswer: true,
                  explanation: true,
                  concepts: {
                    where: { isPrimary: true },
                    select: {
                      conceptVersionId: true,
                      conceptVersion: {
                        select: {
                          title: true,
                          concept: { select: { skillNodeId: true } },
                        },
                      },
                    },
                  },
                },
              },
              session: {
                select: {
                  id: true,
                  status: true,
                  targetCount: true,
                  goalId: true,
                  goalSkillId: true,
                  user: { select: { timezone: true } },
                  goal: { select: { userId: true } },
                  goalSkill: {
                    select: {
                      id: true,
                      userId: true,
                      goalId: true,
                      lifecycle: true,
                      skillNodeId: true,
                      currentScopeVersionId: true,
                      skillNode: {
                        select: {
                          title: true,
                          graph: { select: { userId: true } },
                        },
                      },
                      currentScopeVersion: {
                        select: {
                          id: true,
                          goalSkillId: true,
                          concepts: {
                            where: { requirement: "REQUIRED" },
                            select: { conceptVersionId: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          })

          if (!item) throw notFound()
          if (item.attempt) throw invalidState("This review has already been graded.")
          if (item.status !== "PRESENTED" || item.session.status !== "ACTIVE") {
            throw invalidState("This review is no longer active.")
          }
          if (item.session.targetCount < 1 || item.session.targetCount > 10) {
            throw invalidState("This recall session has an invalid question count.")
          }
          const checkpoint = item.responseCheckpoint
          if (!checkpoint) throw invalidState("This review has already been completed.")
          if (
            checkpoint.phase !== "REVEALED" ||
            !checkpoint.lockedAnswer ||
            !checkpoint.revealedAt
          ) {
            throw invalidState("Reveal the reference before grading.")
          }
          if (checkpoint.version !== input.expectedVersion) {
            throw checkpointConflict(checkpoint)
          }

          const goalSkill = item.session.goalSkill
          const scope = goalSkill?.currentScopeVersion
          if (
            !goalSkill ||
            !scope ||
            goalSkill.lifecycle !== "ACTIVE" ||
            goalSkill.userId !== input.userId ||
            goalSkill.goalId !== item.session.goalId ||
            item.session.goalSkillId !== goalSkill.id ||
            item.session.goal.userId !== input.userId ||
            goalSkill.skillNode.graph.userId !== input.userId ||
            goalSkill.currentScopeVersionId !== scope.id ||
            scope.goalSkillId !== goalSkill.id ||
            scope.concepts.length === 0 ||
            item.question.userId !== input.userId ||
            item.questionRevision.questionId !== item.questionId ||
            item.question.skillNodeId !== goalSkill.skillNodeId
          ) {
            throw invalidState("This skill is no longer ready for practice.")
          }
          const primaryConcepts = item.questionRevision.concepts
          if (primaryConcepts.length !== 1) {
            throw invalidState("This question needs exactly one primary concept.")
          }
          const primaryConceptVersionId = primaryConcepts[0].conceptVersionId
          if (
            primaryConcepts[0].conceptVersion.concept.skillNodeId !==
            goalSkill.skillNodeId
          ) {
            throw invalidState("This question is linked to another skill.")
          }
          const requiredConceptVersionIds = scope.concepts.map(
            ({ conceptVersionId }) => conceptVersionId,
          )
          if (!requiredConceptVersionIds.includes(primaryConceptVersionId)) {
            throw invalidState("This question is outside the current skill scope.")
          }
          if (item.question.state !== "ACTIVE" || !item.question.schedulingEligible) {
            throw invalidState("This question is no longer active.")
          }

          const generatedSpec = item.question.generatedSpec
          let objectiveCorrect: boolean | undefined
          if (generatedSpec?.responseType === "MULTIPLE_CHOICE") {
            const choices = parseGeneratedChoices(generatedSpec.choicesJson)
            const choice = selectedChoice(checkpoint.lockedAnswer, choices.length)
            if (choice === null || generatedSpec.correctChoiceIndex === null) {
              throw invalidState("This multiple-choice answer could not be verified.")
            }
            objectiveCorrect = choice === generatedSpec.correctChoiceIndex
            if (!objectiveCorrect && input.rating !== "AGAIN") {
              throw invalidState("An incorrect answer must be saved as Missed.")
            }
          }

          const schedule = await transaction.reviewSchedule.findUnique({
            where: {
              userId_questionId: { userId: input.userId, questionId: item.questionId },
            },
          })
          if (!schedule) throw invalidState("This review no longer has a schedule.")
          if (
            schedule.questionRevisionId !== item.questionRevisionId ||
            schedule.algorithmVersion !== item.scheduleAlgorithmVersion ||
            schedule.dueAt.getTime() !== item.scheduleDueAtBefore.getTime() ||
            schedule.intervalMinutes !== item.intervalMinutesBefore ||
            schedule.repetitions !== item.repetitionsBefore ||
            schedule.lapses !== item.lapsesBefore
          ) {
            throw new PracticeServiceError(
              "This review changed after the session started. Start a fresh review.",
              "SCHEDULE_VERSION_CONFLICT",
              409,
            )
          }

          const occurredAt = copyServerTime(clock)
          const transition = scheduleNextReview({
            current: {
              dueAt: schedule.dueAt,
              intervalMinutes: schedule.intervalMinutes,
              repetitions: schedule.repetitions,
              lapses: schedule.lapses,
              version: schedule.version,
              lastReviewedAt: schedule.lastReviewedAt,
            },
            rating: input.rating,
            occurredAt,
          })
          const reviewDay = toReviewDay(occurredAt, item.session.user.timezone)

          const existingEvidenceRows = await transaction.masteryEvidence.findMany({
            where: {
              userId: input.userId,
              conceptVersionId: { in: requiredConceptVersionIds },
            },
            orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
            select: {
              conceptVersionId: true,
              kind: true,
              weight: true,
              reviewDay: true,
              occurredAt: true,
              attempt: {
                select: {
                  rating: true,
                  questionId: true,
                  occurredAt: true,
                  question: {
                    select: {
                      generatedSpec: { select: { questionFamilyId: true } },
                    },
                  },
                  sessionItem: {
                    select: {
                      sessionId: true,
                      completedAt: true,
                      session: { select: { completedAt: true } },
                    },
                  },
                },
              },
            },
          })
          const existingEvidence: MasteryEvidenceInput[] = existingEvidenceRows.map((row) => {
            const completedAt =
              row.attempt.sessionItem.completedAt ??
              row.attempt.sessionItem.session.completedAt ??
              row.attempt.occurredAt
            if (!completedAt) {
              throw invalidState("Historical practice is missing its session completion.")
            }
            return {
              conceptVersionId: row.conceptVersionId,
              kind: row.kind,
              questionId: row.attempt.questionId,
              questionFamilyId:
                row.attempt.question.generatedSpec?.questionFamilyId ?? undefined,
              sessionId: row.attempt.sessionItem.sessionId,
              sessionCompletedAt: completedAt,
              rating: row.attempt.rating as ReviewRating,
              weight: row.weight as 0 | 0.5 | 1,
              reviewDay: row.reviewDay,
              occurredAt: row.occurredAt,
            }
          })

          const scheduleRows = await transaction.reviewSchedule.findMany({
            where: {
              userId: input.userId,
              question: {
                state: "ACTIVE",
                schedulingEligible: true,
                skillNodeId: goalSkill.skillNodeId,
                goalQuestions: {
                  some: { goalId: item.session.goalId, status: "ACTIVE" },
                },
              },
              questionRevision: {
                concepts: {
                  some: {
                    isPrimary: true,
                    conceptVersionId: { in: requiredConceptVersionIds },
                  },
                },
              },
            },
            select: {
              id: true,
              dueAt: true,
              intervalMinutes: true,
              questionRevision: {
                select: {
                  concepts: {
                    where: { isPrimary: true },
                    select: { conceptVersionId: true },
                  },
                },
              },
            },
          })
          const activeQuestionConceptVersionIds = scheduleRows.flatMap((row) =>
            row.questionRevision.concepts.map(({ conceptVersionId }) => conceptVersionId),
          )
          const schedulesBefore: ActiveConceptSchedule[] = scheduleRows.flatMap((row) =>
            row.questionRevision.concepts.map(({ conceptVersionId }) => ({
              conceptVersionId,
              dueAt: row.dueAt,
              intervalMinutes: row.intervalMinutes,
            })),
          )
          const schedulesAfter: ActiveConceptSchedule[] = scheduleRows.flatMap((row) =>
            row.questionRevision.concepts.map(({ conceptVersionId }) => ({
              conceptVersionId,
              dueAt: row.id === schedule.id ? transition.after.dueAt : row.dueAt,
              intervalMinutes:
                row.id === schedule.id
                  ? transition.after.intervalMinutes
                  : row.intervalMinutes,
            })),
          )

          const evidenceWeight = getEvidenceWeight(
            existingEvidence.filter(
              (evidence) => evidence.conceptVersionId === primaryConceptVersionId,
            ),
            reviewDay,
          )
          const newEvidence: MasteryEvidenceInput = {
            conceptVersionId: primaryConceptVersionId,
            kind:
              generatedSpec?.role === "TRANSFER"
                ? objectiveCorrect === undefined
                  ? "SELF_ASSESSED_TRANSFER"
                  : "OBJECTIVE_TRANSFER"
                : objectiveCorrect === undefined
                  ? "SELF_ASSESSED_RECALL"
                  : "OBJECTIVE_RECALL",
            questionId: item.questionId,
            questionFamilyId: generatedSpec?.questionFamilyId,
            sessionId: item.session.id,
            sessionCompletedAt: occurredAt,
            rating: input.rating,
            weight: evidenceWeight,
            reviewDay,
            occurredAt,
          }
          const readinessBefore = projectGoalSkillReadiness({
            requiredConceptVersionIds,
            activeQuestionConceptVersionIds,
            evidence: existingEvidence,
            activeSchedules: schedulesBefore,
            computedAt: occurredAt,
          })
          const readinessAfter = projectGoalSkillReadiness({
            requiredConceptVersionIds,
            activeQuestionConceptVersionIds,
            evidence: [...existingEvidence, newEvidence],
            activeSchedules: schedulesAfter,
            computedAt: occurredAt,
          })

          const checkpointUpdate = await transaction.practiceResponseCheckpoint.updateMany({
            where: {
              id: checkpoint.id,
              userId: input.userId,
              phase: "REVEALED",
              version: input.expectedVersion,
            },
            data: {
              phase: "SAVING",
              pendingRating: input.rating,
              gradeIdempotencyKey: input.idempotencyKey,
              version: { increment: 1 },
            },
          })
          if (checkpointUpdate.count !== 1) {
            const latest = await findLatestCheckpoint(transaction, input.userId, input.itemId)
            if (!latest) throw invalidState("This review has already been completed.")
            throw checkpointConflict(latest)
          }

          const scheduleUpdate = await transaction.reviewSchedule.updateMany({
            where: {
              id: schedule.id,
              userId: input.userId,
              version: schedule.version,
              questionRevisionId: item.questionRevisionId,
            },
            data: {
              dueAt: transition.after.dueAt,
              intervalMinutes: transition.after.intervalMinutes,
              repetitions: transition.after.repetitions,
              lapses: transition.after.lapses,
              lastReviewedAt: transition.after.lastReviewedAt,
              version: transition.after.version,
            },
          })
          if (scheduleUpdate.count !== 1) {
            throw new PracticeServiceError(
              "The review schedule changed. Try again.",
              "SCHEDULE_VERSION_CONFLICT",
              409,
            )
          }

          const responseTimeMs = Math.min(
            MAX_RESPONSE_TIME_MS,
            Math.max(0, occurredAt.getTime() - item.presentedAt.getTime()),
          )
          const attempt = await transaction.attempt.create({
            data: {
              userId: input.userId,
              sessionItemId: item.id,
              questionId: item.questionId,
              questionRevisionId: item.questionRevisionId,
              lockedAnswer: checkpoint.lockedAnswer,
              rating: input.rating,
              revealedAt: checkpoint.revealedAt,
              responseTimeMs,
              idempotencyKey: input.idempotencyKey,
              occurredAt,
              dueAtBefore: transition.before.dueAt,
              dueAtAfter: transition.after.dueAt,
              intervalMinutesBefore: transition.before.intervalMinutes,
              intervalMinutesAfter: transition.after.intervalMinutes,
              repetitionsBefore: transition.before.repetitions,
              repetitionsAfter: transition.after.repetitions,
              lapsesBefore: transition.before.lapses,
              lapsesAfter: transition.after.lapses,
              scheduleAlgorithmVersion: transition.algorithmVersion,
              evidenceStageBefore: readinessBefore.stage,
              evidenceStageAfter: readinessAfter.stage,
              confidenceBefore: readinessBefore.confidence,
              confidenceAfter: readinessAfter.confidence,
            },
          })
          await transaction.masteryEvidence.create({
            data: {
              userId: input.userId,
              attemptId: attempt.id,
              conceptVersionId: primaryConceptVersionId,
              kind: newEvidence.kind,
              normalizedScore: getRatingScore(input.rating),
              weight: evidenceWeight,
              reviewDay,
              reviewTimezone: item.session.user.timezone,
              occurredAt,
              algorithmVersion: MASTERY_RULE_VERSION,
            },
          })

          let gapId: string | undefined
          let resolvedGapId: string | undefined
          if (input.rating === "AGAIN" && generatedSpec) {
            const gap = await createOrReopenRecallGapInTransaction(transaction, {
              userId: input.userId,
              goalSkillId: goalSkill.id,
              conceptVersionId: primaryConceptVersionId,
              questionId: item.questionId,
              questionRevisionId: item.questionRevisionId,
              attemptId: attempt.id,
              openedAt: occurredAt,
              openedReviewDay: reviewDay,
              content: recallRemediationContent({
                competencyTitle: primaryConcepts[0].conceptVersion.title,
                responseType: generatedSpec.responseType,
                referenceAnswer: item.questionRevision.referenceAnswer,
                explanation: item.questionRevision.explanation,
                sourceVersionId: generatedSpec.sourceVersionId,
                citationLocator: generatedSpec.citationLocator,
                citationExcerpt: generatedSpec.citationExcerpt,
              }),
            })
            gapId = gap.gapId
          } else if (input.rating !== "AGAIN") {
            const resolution = await resolveLearningGapFromRecallInTransaction(
              transaction,
              {
                userId: input.userId,
                goalSkillId: goalSkill.id,
                conceptVersionId: primaryConceptVersionId,
                attemptId: attempt.id,
                resolvedAt: occurredAt,
              },
            )
            resolvedGapId = resolution?.gapId
          }

          await transaction.goalSkillReadiness.upsert({
            where: {
              goalSkillId_scopeVersionId_ruleVersion: {
                goalSkillId: goalSkill.id,
                scopeVersionId: scope.id,
                ruleVersion: readinessAfter.ruleVersion,
              },
            },
            create: {
              goalSkillId: goalSkill.id,
              scopeVersionId: scope.id,
              ...readinessData(readinessAfter),
            },
            update: readinessData(readinessAfter),
          })

          const remainingItems = await transaction.practiceSessionItem.count({
            where: {
              sessionId: item.session.id,
              id: { not: item.id },
              status: "PRESENTED",
            },
          })
          const sessionComplete = remainingItems === 0
          const completedCount = item.session.targetCount - remainingItems
          const summary: PracticeSummary = {
            skillTitle: goalSkill.skillNode.title,
            goalSkillId: goalSkill.id,
            stageBefore: readinessBefore.stage,
            stageAfter: readinessAfter.stage,
            confidence: readinessAfter.confidence,
            rating: input.rating,
            evidenceWeight,
            timezone: item.session.user.timezone,
            nextReviewAt: transition.after.dueAt.toISOString(),
            reason: reasonFor(readinessAfter),
            dueState: deriveDueState(transition.after.dueAt, occurredAt),
            ...(objectiveCorrect === undefined ? {} : { objectiveCorrect }),
            ...(generatedSpec?.role === "TRANSFER" ? { isTransfer: true } : {}),
            ...(gapId ? { gapId } : {}),
            ...(resolvedGapId ? { resolvedGapId } : {}),
            sessionComplete,
            completedCount,
            totalCount: item.session.targetCount,
          }
          await transaction.practiceSessionItem.update({
            where: { id: item.id },
            data: {
              status: "COMPLETED",
              completedAt: occurredAt,
              resultJson: JSON.stringify(summary),
            },
          })
          if (sessionComplete) {
            await transaction.practiceSession.update({
              where: { id: item.session.id },
              data: { status: "COMPLETED", completedAt: occurredAt },
            })
          }
          await transaction.practiceResponseCheckpoint.delete({
            where: { id: checkpoint.id },
          })

          return summary
        })
      } catch (error) {
        if (error instanceof PracticeServiceError) throw error
        if (isUniqueConstraintError(error)) {
          const recovered = await recoverIdempotentGrade(
            database,
            input.userId,
            input.itemId,
            input.idempotencyKey,
          )
          if (recovered) return recovered
        }
        throw error
      }
    },
  }
}

export const practiceService = createPracticeService(prisma)
