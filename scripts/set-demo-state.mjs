import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { PrismaClient } from "@prisma/client"
import { createJiti } from "jiti"

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const expectedDatabaseUrl = "file:./dev.local.db"
const demoEmail = "demo@rehearse.local"
const demoPassword = "RehearseDemo!2026"
const supportedStates = new Set(["well-learned", "refresh-due", "lapse"])
const stateName = process.argv[2]

if (process.env.NODE_ENV === "production") {
  throw new Error("Demo state fixtures are disabled in production.")
}

if (process.env.DATABASE_URL && process.env.DATABASE_URL !== expectedDatabaseUrl) {
  throw new Error(
    `Refusing to change DATABASE_URL=${process.env.DATABASE_URL}. ` +
      `This command may use only ${expectedDatabaseUrl}.`,
  )
}

if (!supportedStates.has(stateName)) {
  console.error(`Usage: npm run demo:state -- <state>

States:
  well-learned  High-confidence mastery with a future review
  refresh-due   The same mastery evidence with an overdue review
  lapse         A missed overdue review recomputed to Learning

Run npm run db:local:reset first if the local demo data is missing.`)
  process.exit(1)
}

process.env.DATABASE_URL = expectedDatabaseUrl

const jiti = createJiti(import.meta.url, {
  alias: { "@": join(projectRoot, "src") },
})
const {
  deriveDisplayStage,
  getEvidenceWeight,
  MASTERY_RULE_VERSION,
  projectGoalSkillReadiness,
} = await jiti.import("../src/lib/learning/mastery.ts")
const { toReviewDay } = await jiti.import("../src/lib/learning/review-day.ts")
const {
  deriveDueState,
  getRatingScore,
  scheduleNextReview,
} = await jiti.import("../src/lib/learning/schedule.ts")

const prisma = new PrismaClient()
const minute = 60_000
const day = 24 * 60 * minute
const historyRatings = ["GOOD", "HARD", "HARD", "HARD", "HARD", "GOOD", "GOOD", "GOOD", "GOOD"]

function readinessData(readiness) {
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

function project(conceptVersionId, evidence, schedule, computedAt) {
  return projectGoalSkillReadiness({
    requiredConceptVersionIds: [conceptVersionId],
    activeQuestionConceptVersionIds: [conceptVersionId],
    evidence,
    activeSchedules: [
      {
        conceptVersionId,
        dueAt: schedule.dueAt,
        intervalMinutes: schedule.intervalMinutes,
      },
    ],
    computedAt,
  })
}

function simulateHistory(startedAt, conceptVersionId) {
  let schedule = {
    dueAt: new Date(startedAt),
    intervalMinutes: 0,
    repetitions: 0,
    lapses: 0,
    version: 0,
    lastReviewedAt: null,
  }
  const evidence = []
  const records = []

  historyRatings.forEach((rating, index) => {
    const occurredAt = new Date(schedule.dueAt)
    const sessionId = `local-demo-proof-session-${String(index + 1).padStart(2, "0")}`
    const reviewDay = toReviewDay(occurredAt, "UTC")
    const readinessBefore = project(conceptVersionId, evidence, schedule, occurredAt)
    const transition = scheduleNextReview({ current: schedule, rating, occurredAt })
    const evidenceWeight = getEvidenceWeight(evidence, reviewDay)
    const isTransfer = index === 5 || index === 8
    const nextEvidence = {
      conceptVersionId,
      kind: isTransfer ? "SELF_ASSESSED_TRANSFER" : "SELF_ASSESSED_RECALL",
      questionId: isTransfer ? `local-demo-transfer-question-${index}` : "local-demo-question",
      questionFamilyId: isTransfer ? `local-demo-transfer-family-${index}` : undefined,
      sessionId,
      sessionCompletedAt: occurredAt,
      rating,
      weight: evidenceWeight,
      reviewDay,
      occurredAt,
    }
    const readinessAfter = project(
      conceptVersionId,
      [...evidence, nextEvidence],
      transition.after,
      occurredAt,
    )

    records.push({
      sessionId,
      rating,
      occurredAt,
      reviewDay,
      evidenceWeight,
      transition,
      readinessBefore,
      readinessAfter,
    })
    evidence.push(nextEvidence)
    schedule = transition.after
  })

  return { evidence, records, schedule }
}

function historyDuration() {
  const simulated = simulateHistory(new Date(0), "duration-placeholder")
  return {
    offsetToLastReview:
      simulated.records.at(-1).occurredAt.getTime() - simulated.records[0].occurredAt.getTime(),
    finalIntervalMinutes: simulated.schedule.intervalMinutes,
  }
}

function buildScenario(now, conceptVersionId) {
  const { offsetToLastReview, finalIntervalMinutes } = historyDuration()
  const finalIntervalMs = finalIntervalMinutes * minute
  const latestGoodAt =
    stateName === "well-learned"
      ? new Date(now.getTime() - minute)
      : new Date(now.getTime() - finalIntervalMs - 2 * day)
  const startedAt = new Date(latestGoodAt.getTime() - offsetToLastReview)
  const history = simulateHistory(startedAt, conceptVersionId)

  if (stateName !== "lapse") return history

  const occurredAt = new Date(now.getTime() - minute)
  const rating = "AGAIN"
  const sessionId = "local-demo-proof-session-10"
  const reviewDay = toReviewDay(occurredAt, "UTC")
  const readinessBefore = project(
    conceptVersionId,
    history.evidence,
    history.schedule,
    occurredAt,
  )
  const transition = scheduleNextReview({
    current: history.schedule,
    rating,
    occurredAt,
  })
  const evidenceWeight = getEvidenceWeight(history.evidence, reviewDay)
  const nextEvidence = {
    conceptVersionId,
    sessionId,
    sessionCompletedAt: occurredAt,
    rating,
    weight: evidenceWeight,
    reviewDay,
    occurredAt,
  }
  const readinessAfter = project(
    conceptVersionId,
    [...history.evidence, nextEvidence],
    transition.after,
    occurredAt,
  )

  return {
    evidence: [...history.evidence, nextEvidence],
    records: [
      ...history.records,
      {
        sessionId,
        rating,
        occurredAt,
        reviewDay,
        evidenceWeight,
        transition,
        readinessBefore,
        readinessAfter,
      },
    ],
    schedule: transition.after,
  }
}

function resultReason(readiness) {
  if (readiness.stage === "WELL_LEARNED") return "Well learned for this goal."
  if (readiness.latestRating === "AGAIN") return "A quick refresh is scheduled."
  if (readiness.stage === "DEMONSTRATED") return "Recall demonstrated across days."
  return "Review saved."
}

function assertScenario(readiness, dueState, schedule) {
  if (stateName === "well-learned") {
    if (readiness.stage !== "WELL_LEARNED" || dueState !== "CURRENT") {
      throw new Error("The Well learned fixture did not satisfy its policy checks.")
    }
    return
  }

  if (stateName === "refresh-due") {
    if (
      readiness.stage !== "WELL_LEARNED" ||
      deriveDisplayStage(readiness.stage, dueState) !== "REFRESH_DUE"
    ) {
      throw new Error("The Refresh due fixture did not retain Well learned mastery.")
    }
    return
  }

  if (
    readiness.stage !== "LEARNING" ||
    readiness.latestRating !== "AGAIN" ||
    schedule.intervalMinutes !== 10 ||
    schedule.repetitions !== 0 ||
    schedule.lapses !== 1
  ) {
    throw new Error("The lapse fixture did not recompute mastery and scheduling.")
  }
}

try {
  const user = await prisma.user.findUnique({
    where: { email: demoEmail },
    select: { id: true },
  })
  if (!user) throw new Error("Local demo data is missing. Run npm run db:local:reset first.")

  const goal = await prisma.learningGoal.findFirst({
    where: { id: "local-demo-goal", userId: user.id },
    select: {
      id: true,
      goalSkills: {
        where: { id: "local-demo-goal-skill", lifecycle: "ACTIVE" },
        take: 1,
        select: { id: true, currentScopeVersionId: true },
      },
    },
  })
  const question = await prisma.question.findFirst({
    where: {
      id: "local-demo-question",
      userId: user.id,
      state: "ACTIVE",
      schedulingEligible: true,
    },
    select: {
      id: true,
      currentRevisionId: true,
      currentRevision: {
        select: {
          concepts: {
            where: { isPrimary: true },
            select: { conceptVersionId: true },
          },
        },
      },
    },
  })
  const goalSkill = goal?.goalSkills[0]
  const conceptVersionId = question?.currentRevision?.concepts[0]?.conceptVersionId

  if (
    !goal ||
    !goalSkill?.currentScopeVersionId ||
    !question?.currentRevisionId ||
    !conceptVersionId ||
    question.currentRevision.concepts.length !== 1
  ) {
    throw new Error("Local demo learning data is incomplete. Run npm run db:local:reset first.")
  }

  const now = new Date(Math.floor(Date.now() / minute) * minute)
  const scenario = buildScenario(now, conceptVersionId)
  const readiness = project(conceptVersionId, scenario.evidence, scenario.schedule, now)
  const dueState = deriveDueState(scenario.schedule.dueAt, now)
  assertScenario(readiness, dueState, scenario.schedule)

  await prisma.$transaction(
    async (transaction) => {
      const oldSessions = await transaction.practiceSession.findMany({
        where: { userId: user.id, goalId: goal.id },
        select: {
          id: true,
          items: { select: { id: true, attempt: { select: { id: true } } } },
        },
      })
      const oldItemIds = oldSessions.flatMap((session) =>
        session.items.map((item) => item.id),
      )
      const oldAttemptIds = oldSessions.flatMap((session) =>
        session.items.flatMap((item) => (item.attempt ? [item.attempt.id] : [])),
      )

      if (oldAttemptIds.length > 0) {
        await transaction.masteryEvidence.deleteMany({
          where: { userId: user.id, attemptId: { in: oldAttemptIds } },
        })
        await transaction.attempt.deleteMany({
          where: { userId: user.id, id: { in: oldAttemptIds } },
        })
      }
      if (oldItemIds.length > 0) {
        await transaction.practiceResponseCheckpoint.deleteMany({
          where: { userId: user.id, sessionItemId: { in: oldItemIds } },
        })
      }
      if (oldSessions.length > 0) {
        await transaction.practiceSession.deleteMany({
          where: { userId: user.id, id: { in: oldSessions.map((session) => session.id) } },
        })
      }

      await transaction.user.update({
        where: { id: user.id },
        data: { timezone: "UTC" },
      })

      for (const [index, record] of scenario.records.entries()) {
        const itemId = `local-demo-proof-item-${String(index + 1).padStart(2, "0")}`
        const attemptId = `local-demo-proof-attempt-${String(index + 1).padStart(2, "0")}`
        const completedAt = record.occurredAt
        const summary = {
          skillTitle: "Idempotent operations",
          stageBefore: record.readinessBefore.stage,
          stageAfter: record.readinessAfter.stage,
          confidence: record.readinessAfter.confidence,
          rating: record.rating,
          evidenceWeight: record.evidenceWeight,
          timezone: "UTC",
          nextReviewAt: record.transition.after.dueAt.toISOString(),
          reason: resultReason(record.readinessAfter),
          dueState: deriveDueState(record.transition.after.dueAt, completedAt),
        }

        await transaction.practiceSession.create({
          data: {
            id: record.sessionId,
            userId: user.id,
            goalId: goal.id,
            goalSkillId: goalSkill.id,
            reason: index === 0 ? "BASELINE" : "DUE",
            status: "COMPLETED",
            targetCount: 1,
            startedAt: new Date(completedAt.getTime() - 30_000),
            completedAt,
          },
        })
        await transaction.practiceSessionItem.create({
          data: {
            id: itemId,
            sessionId: record.sessionId,
            questionId: question.id,
            questionRevisionId: question.currentRevisionId,
            ordinal: 0,
            status: "COMPLETED",
            scheduleDueAtBefore: record.transition.before.dueAt,
            intervalMinutesBefore: record.transition.before.intervalMinutes,
            repetitionsBefore: record.transition.before.repetitions,
            lapsesBefore: record.transition.before.lapses,
            scheduleAlgorithmVersion: record.transition.algorithmVersion,
            presentedAt: new Date(completedAt.getTime() - 30_000),
            completedAt,
            resultJson: JSON.stringify(summary),
          },
        })
        await transaction.attempt.create({
          data: {
            id: attemptId,
            userId: user.id,
            sessionItemId: itemId,
            questionId: question.id,
            questionRevisionId: question.currentRevisionId,
            lockedAnswer: "A repeated request returns its stored result without repeating the side effect.",
            rating: record.rating,
            revealedAt: new Date(completedAt.getTime() - 10_000),
            responseTimeMs: 20_000,
            idempotencyKey: `local-demo-proof-grade-${String(index + 1).padStart(2, "0")}`,
            occurredAt: completedAt,
            dueAtBefore: record.transition.before.dueAt,
            dueAtAfter: record.transition.after.dueAt,
            intervalMinutesBefore: record.transition.before.intervalMinutes,
            intervalMinutesAfter: record.transition.after.intervalMinutes,
            repetitionsBefore: record.transition.before.repetitions,
            repetitionsAfter: record.transition.after.repetitions,
            lapsesBefore: record.transition.before.lapses,
            lapsesAfter: record.transition.after.lapses,
            scheduleAlgorithmVersion: record.transition.algorithmVersion,
            evidenceStageBefore: record.readinessBefore.stage,
            evidenceStageAfter: record.readinessAfter.stage,
            confidenceBefore: record.readinessBefore.confidence,
            confidenceAfter: record.readinessAfter.confidence,
          },
        })
        await transaction.masteryEvidence.create({
          data: {
            id: `local-demo-proof-evidence-${String(index + 1).padStart(2, "0")}`,
            userId: user.id,
            attemptId,
            conceptVersionId,
            kind: record.readinessAfter.successfulTransferProbes >
              record.readinessBefore.successfulTransferProbes
              ? "SELF_ASSESSED_TRANSFER"
              : "SELF_ASSESSED_RECALL",
            normalizedScore: getRatingScore(record.rating),
            weight: record.evidenceWeight,
            reviewDay: record.reviewDay,
            reviewTimezone: "UTC",
            occurredAt: completedAt,
            algorithmVersion: MASTERY_RULE_VERSION,
          },
        })
      }

      await transaction.reviewSchedule.update({
        where: {
          userId_questionId: { userId: user.id, questionId: question.id },
        },
        data: {
          questionRevisionId: question.currentRevisionId,
          dueAt: scenario.schedule.dueAt,
          intervalMinutes: scenario.schedule.intervalMinutes,
          repetitions: scenario.schedule.repetitions,
          lapses: scenario.schedule.lapses,
          lastReviewedAt: scenario.schedule.lastReviewedAt,
          algorithmVersion: "schedule-v1",
          version: scenario.schedule.version,
        },
      })
      await transaction.goalSkillReadiness.upsert({
        where: {
          goalSkillId_scopeVersionId_ruleVersion: {
            goalSkillId: goalSkill.id,
            scopeVersionId: goalSkill.currentScopeVersionId,
            ruleVersion: readiness.ruleVersion,
          },
        },
        create: {
          id: "local-demo-readiness",
          goalSkillId: goalSkill.id,
          scopeVersionId: goalSkill.currentScopeVersionId,
          ...readinessData(readiness),
        },
        update: readinessData(readiness),
      })
    },
    { maxWait: 5_000, timeout: 20_000 },
  )

  const displayStage = deriveDisplayStage(readiness.stage, dueState)
  console.log(`Demo state ready: ${displayStage.toLowerCase().replaceAll("_", " ")}`)
  console.log(`  Mastery: ${readiness.stage} (${readiness.confidence} confidence)`)
  console.log(`  Latest: ${readiness.latestRating}`)
  console.log(`  Evidence: ${readiness.completedSessions} sessions across ${readiness.distinctReviewDays} days`)
  console.log(`  Schedule: ${dueState}; ${scenario.schedule.intervalMinutes} minute interval; ${scenario.schedule.lapses} lapse(s)`)
  console.log("  Open: http://localhost:3000/today")
  console.log(`  Sign in: ${demoEmail} / ${demoPassword}`)
} finally {
  await prisma.$disconnect()
}
