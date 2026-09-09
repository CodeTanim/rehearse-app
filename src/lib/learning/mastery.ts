import { differenceInReviewDays } from "@/lib/learning/review-day"
import { getRatingScore } from "@/lib/learning/schedule"
import type {
  DueState,
  EvidenceConfidence,
  EvidenceStage,
  GoalSkillReadinessInput,
  GoalSkillReadinessResult,
  MasteryEvidenceInput,
  MasteryReasonCode,
  ReviewRating,
  SkillDisplayStage,
} from "@/lib/learning/types"

export const MASTERY_RULE_VERSION = "mastery-v1"
export const WELL_LEARNED_INTERVAL_MINUTES = 21 * 24 * 60

const SUCCESSFUL_RATINGS = new Set<ReviewRating>(["HARD", "GOOD", "EASY"])
const WELL_LEARNED_LATEST_RATINGS = new Set<ReviewRating>(["GOOD", "EASY"])

type EvidenceDay = Pick<MasteryEvidenceInput, "reviewDay">

function isSuccessful(rating: ReviewRating) {
  return SUCCESSFUL_RATINGS.has(rating)
}

function isTransferEvidence(kind: string | undefined) {
  return kind === "OBJECTIVE_TRANSFER" || kind === "SELF_ASSESSED_TRANSFER"
}

function isValidDate(value: Date) {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

function roundIndex(value: number) {
  return Math.round(value * 10_000) / 10_000
}

function mean(values: readonly number[]) {
  if (values.length === 0) return null
  return roundIndex(values.reduce((total, value) => total + value, 0) / values.length)
}

function median(values: readonly number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

function uniqueNonEmpty(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.length > 0))]
}

function sortedEvidence(evidence: readonly MasteryEvidenceInput[]) {
  return [...evidence].sort((left, right) => {
    const timeDifference = left.occurredAt.getTime() - right.occurredAt.getTime()
    if (timeDifference !== 0) return timeDifference
    const sessionDifference = left.sessionId.localeCompare(right.sessionId)
    if (sessionDifference !== 0) return sessionDifference
    return left.conceptVersionId.localeCompare(right.conceptVersionId)
  })
}

function confidenceFor(
  fullWeightReviews: number,
  distinctReviewDays: number,
  spanDays: number,
): EvidenceConfidence {
  if (fullWeightReviews >= 8 && distinctReviewDays >= 3 && spanDays >= 14) {
    return "HIGH"
  }
  if (fullWeightReviews >= 3 && distinctReviewDays >= 2) {
    return "MEDIUM"
  }
  return "LOW"
}

function recentSessionIndex(evidence: readonly MasteryEvidenceInput[]) {
  const sessions = new Map<
    string,
    { completedAt: Date; scores: number[] }
  >()

  for (const item of evidence) {
    const existing = sessions.get(item.sessionId)
    if (existing) {
      existing.scores.push(getRatingScore(item.rating))
      if (item.sessionCompletedAt > existing.completedAt) {
        existing.completedAt = item.sessionCompletedAt
      }
    } else {
      sessions.set(item.sessionId, {
        completedAt: item.sessionCompletedAt,
        scores: [getRatingScore(item.rating)],
      })
    }
  }

  const mostRecent = [...sessions.entries()]
    .sort((left, right) => {
      const timeDifference = right[1].completedAt.getTime() - left[1].completedAt.getTime()
      return timeDifference || right[0].localeCompare(left[0])
    })
    .slice(0, 3)

  return {
    completedSessions: sessions.size,
    index: mean(
      mostRecent.map(([, session]) =>
        session.scores.reduce((total, score) => total + score, 0) / session.scores.length,
      ),
    ),
  }
}

function explanationReasons(input: {
  stage: EvidenceStage
  evidenceCount: number
  coverageComplete: boolean
  everyConceptHasSuccess: boolean
  everyConceptHasTwoSuccessfulDays: boolean
  successfulFullWeightReviews: number
  successfulFullWeightDays: number
  distinctReviewDays: number
  spanDays: number
  everyLatestNotAgain: boolean
  everyLatestGoodOrEasy: boolean
  recentThreeSessionIndex: number | null
  completedSessions: number
  medianIntervalMinutes: number | null
  confidence: EvidenceConfidence
  latestRating: ReviewRating | null
  successfulTransferProbes: number
  transferReviewDays: number
  transferSessions: number
}) {
  if (input.stage === "UNASSESSED") {
    return ["NO_QUALIFYING_REVIEWS"] satisfies MasteryReasonCode[]
  }
  if (input.stage === "WELL_LEARNED") {
    return ["WELL_LEARNED_REQUIREMENTS_MET"] satisfies MasteryReasonCode[]
  }

  const reasons: MasteryReasonCode[] = []
  if (input.stage === "DEMONSTRATED") reasons.push("DEMONSTRATED_REQUIREMENTS_MET")
  if (input.evidenceCount === 1) reasons.push("FIRST_REVIEW_RECORDED")
  if (!input.coverageComplete) reasons.push("SCOPE_INCOMPLETE")
  if (!input.everyConceptHasSuccess) reasons.push("NEEDS_CONCEPT_SUCCESS")
  if (input.successfulFullWeightReviews < 3) {
    reasons.push("NEEDS_SUCCESSFUL_FULL_WEIGHT_REVIEWS")
  }
  if (
    input.successfulFullWeightDays < 2 ||
    input.distinctReviewDays < 3 ||
    !input.everyConceptHasTwoSuccessfulDays
  ) {
    reasons.push("NEEDS_REVIEW_DAYS")
  }
  if (input.spanDays < 14) reasons.push("NEEDS_TIME_SPAN")
  if (!input.everyLatestGoodOrEasy) reasons.push("NEEDS_GOOD_OR_EASY_LATEST")
  if (
    input.completedSessions < 3 ||
    input.recentThreeSessionIndex === null ||
    input.recentThreeSessionIndex < 0.85
  ) {
    reasons.push("NEEDS_RECENT_PERFORMANCE")
  }
  if (
    input.medianIntervalMinutes === null ||
    input.medianIntervalMinutes < WELL_LEARNED_INTERVAL_MINUTES
  ) {
    reasons.push("NEEDS_STABLE_INTERVAL")
  }
  if (input.confidence !== "HIGH") reasons.push("NEEDS_HIGH_CONFIDENCE")
  if (
    input.successfulTransferProbes < 2 ||
    input.transferReviewDays < 2 ||
    input.transferSessions < 2
  ) {
    reasons.push("NEEDS_TRANSFER_EVIDENCE")
  }
  if (input.latestRating === "AGAIN" || !input.everyLatestNotAgain) {
    reasons.push("LATEST_REVIEW_WAS_AGAIN")
  }

  return [...new Set(reasons)]
}

/**
 * Assigns readiness weight for one concept. The baseline consumes its local
 * day at half weight; further same-day attempts remain history but add no
 * readiness weight.
 */
export function getEvidenceWeight(
  existingConceptEvidence: readonly EvidenceDay[],
  reviewDay: string,
): 0 | 0.5 | 1 {
  differenceInReviewDays(reviewDay, reviewDay)
  for (const evidence of existingConceptEvidence) {
    differenceInReviewDays(evidence.reviewDay, evidence.reviewDay)
  }

  if (existingConceptEvidence.length === 0) return 0.5
  if (existingConceptEvidence.some((evidence) => evidence.reviewDay === reviewDay)) return 0
  return 1
}

export function deriveDisplayStage(
  stage: EvidenceStage,
  dueState: DueState,
): SkillDisplayStage {
  if (stage === "WELL_LEARNED" && dueState !== "CURRENT") return "REFRESH_DUE"
  return stage
}

/** Rebuilds goal-scoped readiness entirely from immutable scope and evidence. */
export function projectGoalSkillReadiness({
  requiredConceptVersionIds,
  activeQuestionConceptVersionIds,
  evidence,
  activeSchedules,
  computedAt,
}: GoalSkillReadinessInput): GoalSkillReadinessResult {
  if (!isValidDate(computedAt)) throw new RangeError("computedAt must be a valid Date.")

  const requiredConcepts = uniqueNonEmpty(requiredConceptVersionIds)
  const requiredSet = new Set(requiredConcepts)
  const coveredSet = new Set(
    uniqueNonEmpty(activeQuestionConceptVersionIds).filter((conceptId) => requiredSet.has(conceptId)),
  )
  const relevantEvidence = sortedEvidence(
    evidence.filter((item) => requiredSet.has(item.conceptVersionId)),
  )

  for (const item of relevantEvidence) {
    if (!isValidDate(item.occurredAt) || !isValidDate(item.sessionCompletedAt)) {
      throw new RangeError("Evidence timestamps must be valid Dates.")
    }
    differenceInReviewDays(item.reviewDay, item.reviewDay)
  }

  const weightedEvidence = relevantEvidence.filter((item) => item.weight > 0)
  const fullWeightEvidence = relevantEvidence.filter((item) => item.weight === 1)
  const successfulFullWeightEvidence = fullWeightEvidence.filter((item) =>
    isSuccessful(item.rating),
  )
  const successfulTransferEvidence = relevantEvidence.filter(
    (item) => isTransferEvidence(item.kind) && isSuccessful(item.rating),
  )
  const successfulTransferFamilies = new Set(
    successfulTransferEvidence
      .map((item) => item.questionFamilyId)
      .filter((family): family is string => Boolean(family)),
  )
  const successfulTransferSessions = new Set(
    successfulTransferEvidence.map((item) => item.sessionId),
  )
  const successfulTransferDays = new Set(
    successfulTransferEvidence.map((item) => item.reviewDay),
  )
  const distinctDays = [...new Set(weightedEvidence.map((item) => item.reviewDay))].sort()
  const fullWeightDays = new Set(fullWeightEvidence.map((item) => item.reviewDay)).size
  const spanDays =
    distinctDays.length > 1
      ? differenceInReviewDays(distinctDays[0], distinctDays[distinctDays.length - 1])
      : 0
  const successfulFullWeightDays = new Set(
    successfulFullWeightEvidence.map((item) => item.reviewDay),
  ).size

  const weightedScoreTotal = weightedEvidence.reduce(
    (total, item) => total + getRatingScore(item.rating) * item.weight,
    0,
  )
  const readinessWeightTotal = weightedEvidence.reduce((total, item) => total + item.weight, 0)
  const selfAssessedIndex =
    readinessWeightTotal > 0 ? roundIndex(weightedScoreTotal / readinessWeightTotal) : null

  const perConcept = requiredConcepts.map((conceptVersionId) => {
    const conceptEvidence = relevantEvidence.filter(
      (item) => item.conceptVersionId === conceptVersionId,
    )
    const weightedConceptEvidence = conceptEvidence.filter((item) => item.weight > 0)
    const successfulDays = new Set(
      weightedConceptEvidence.filter((item) => isSuccessful(item.rating)).map((item) => item.reviewDay),
    )
    return {
      hasSuccess: successfulDays.size > 0,
      hasTwoSuccessfulDays: successfulDays.size >= 2,
      latestRating: conceptEvidence.at(-1)?.rating ?? null,
    }
  })

  const everyConceptHasSuccess =
    requiredConcepts.length > 0 && perConcept.every((concept) => concept.hasSuccess)
  const everyConceptHasTwoSuccessfulDays =
    requiredConcepts.length > 0 && perConcept.every((concept) => concept.hasTwoSuccessfulDays)
  const everyLatestNotAgain =
    requiredConcepts.length > 0 &&
    perConcept.every((concept) => concept.latestRating !== null && concept.latestRating !== "AGAIN")
  const everyLatestGoodOrEasy =
    requiredConcepts.length > 0 &&
    perConcept.every(
      (concept) => concept.latestRating !== null && WELL_LEARNED_LATEST_RATINGS.has(concept.latestRating),
    )

  const coverage = requiredConcepts.length === 0 ? 0 : coveredSet.size / requiredConcepts.length
  const scopeCoverage = roundIndex(coverage)
  const coverageComplete = requiredConcepts.length > 0 && coveredSet.size === requiredConcepts.length
  const confidence = confidenceFor(fullWeightEvidence.length, fullWeightDays, spanDays)
  const sessionPerformance = recentSessionIndex(relevantEvidence)
  const relevantSchedules = activeSchedules.filter((schedule) =>
    requiredSet.has(schedule.conceptVersionId),
  )
  const medianIntervalMinutes = median(
    relevantSchedules.map((schedule) => schedule.intervalMinutes),
  )
  const earliestDueAt = relevantSchedules.reduce<Date | null>((earliest, schedule) => {
    if (!isValidDate(schedule.dueAt)) throw new RangeError("Schedule due times must be valid Dates.")
    if (!Number.isInteger(schedule.intervalMinutes) || schedule.intervalMinutes < 0) {
      throw new RangeError("Schedule intervals must be non-negative integers.")
    }
    return earliest === null || schedule.dueAt < earliest ? new Date(schedule.dueAt) : earliest
  }, null)

  const demonstrated =
    coverageComplete &&
    everyConceptHasSuccess &&
    successfulFullWeightEvidence.length >= 3 &&
    successfulFullWeightDays >= 2 &&
    everyLatestNotAgain
  // These are the policy gates themselves, not a separately maintained UI score.
  const requirements = [
    { id: "coverage", label: "Cover the skill", met: coverageComplete,
      detail: `${coveredSet.size} of ${requiredConcepts.length} required ideas have active questions.`,
      next: "Complete skill setup so every required idea has a question." },
    { id: "concepts", label: "Recall every idea", met: everyConceptHasTwoSuccessfulDays,
      detail: `${perConcept.filter((concept) => concept.hasTwoSuccessfulDays).length} of ${requiredConcepts.length} ideas recalled successfully on at least 2 days.`,
      next: "Recall each required idea successfully on two different days." },
    { id: "spacing", label: "Remember over time", met: distinctDays.length >= 3 && spanDays >= 14,
      detail: `${distinctDays.length} review days (need 3), spanning ${spanDays} days (need 14).`,
      next: "Return for scheduled recalls across at least 3 days spanning 14 days. Waiting alone adds no evidence." },
    { id: "latest", label: "Recall with confidence", met: everyLatestGoodOrEasy,
      detail: `${perConcept.filter((concept) => concept.latestRating !== null && WELL_LEARNED_LATEST_RATINGS.has(concept.latestRating)).length} of ${requiredConcepts.length} ideas have a latest Good or Easy recall.`,
      next: "Strengthen missed ideas, then recall them correctly with normal or low effort." },
    { id: "performance", label: "Stay consistent", met: sessionPerformance.completedSessions >= 3 && sessionPerformance.index !== null && sessionPerformance.index >= 0.85,
      detail: `${sessionPerformance.completedSessions} evidence-bearing sessions (need 3). Recent performance index: ${sessionPerformance.index === null ? "not available" : sessionPerformance.index} (need 0.85).`,
      next: "Build consistent results across your latest three recall sessions." },
    { id: "interval", label: "Retain it between recalls", met: medianIntervalMinutes !== null && medianIntervalMinutes >= WELL_LEARNED_INTERVAL_MINUTES,
      detail: `Typical scheduled interval: ${medianIntervalMinutes === null ? "not scheduled" : `${Math.floor(medianIntervalMinutes / 1440)} days`} (need 21).`,
      next: "Keep succeeding at scheduled recalls as the intervals grow." },
    { id: "confidence", label: "Build enough evidence", met: confidence === "HIGH",
      detail: `${fullWeightEvidence.length} full-weight recalls (need 8), on ${fullWeightDays} days (need 3), spanning ${spanDays} days (need 14).`,
      next: "Keep your scheduled recalls. Same-day repeats do not add readiness weight." },
    { id: "transfer", label: "Apply it in new situations", met: successfulTransferFamilies.size >= 2 && successfulTransferSessions.size >= 2 && successfulTransferDays.size >= 2,
      detail: `${successfulTransferFamilies.size} distinct new-angle challenges, ${successfulTransferSessions.size} sessions, ${successfulTransferDays.size} days (need 2 of each).`,
      next: "Answer two different new-angle challenges successfully, in separate recalls on different days." },
  ]
  const wellLearned = requirements.every((requirement) => requirement.met)

  const stage: EvidenceStage =
    relevantEvidence.length === 0
      ? "UNASSESSED"
      : wellLearned
        ? "WELL_LEARNED"
        : demonstrated
          ? "DEMONSTRATED"
          : "LEARNING"
  const latestRating = relevantEvidence.at(-1)?.rating ?? null
  const reasons = explanationReasons({
    stage,
    evidenceCount: relevantEvidence.length,
    coverageComplete,
    everyConceptHasSuccess,
    everyConceptHasTwoSuccessfulDays,
    successfulFullWeightReviews: successfulFullWeightEvidence.length,
    successfulFullWeightDays,
    distinctReviewDays: distinctDays.length,
    spanDays,
    everyLatestNotAgain,
    everyLatestGoodOrEasy,
    recentThreeSessionIndex: sessionPerformance.index,
    completedSessions: sessionPerformance.completedSessions,
    medianIntervalMinutes,
    confidence,
    latestRating,
    successfulTransferProbes: successfulTransferFamilies.size,
    transferReviewDays: successfulTransferDays.size,
    transferSessions: successfulTransferSessions.size,
  })

  return {
    milestone: { ruleVersion: MASTERY_RULE_VERSION, requirements },
    ruleVersion: MASTERY_RULE_VERSION,
    stage,
    confidence,
    scopeCoverage,
    selfAssessedIndex,
    recentThreeSessionIndex: sessionPerformance.index,
    fullWeightReviews: fullWeightEvidence.length,
    successfulFullWeightReviews: successfulFullWeightEvidence.length,
    distinctReviewDays: distinctDays.length,
    spanDays,
    completedSessions: sessionPerformance.completedSessions,
    latestRating,
    earliestDueAt,
    medianIntervalMinutes,
    successfulTransferProbes: successfulTransferFamilies.size,
    transferReviewDays: successfulTransferDays.size,
    explanation: {
      reasons,
      facts: {
        requiredConcepts: requiredConcepts.length,
        coveredRequiredConcepts: coveredSet.size,
        fullWeightReviews: fullWeightEvidence.length,
        successfulFullWeightReviews: successfulFullWeightEvidence.length,
        distinctReviewDays: distinctDays.length,
        spanDays,
        completedSessions: sessionPerformance.completedSessions,
        medianIntervalMinutes,
        successfulTransferProbes: successfulTransferFamilies.size,
        transferReviewDays: successfulTransferDays.size,
      },
    },
    computedAt: new Date(computedAt),
  }
}
