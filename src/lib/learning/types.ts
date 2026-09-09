export const REVIEW_RATINGS = ["AGAIN", "HARD", "GOOD", "EASY"] as const
export type ReviewRating = (typeof REVIEW_RATINGS)[number]

export const EVIDENCE_STAGES = [
  "UNASSESSED",
  "LEARNING",
  "DEMONSTRATED",
  "WELL_LEARNED",
] as const
export type EvidenceStage = (typeof EVIDENCE_STAGES)[number]

export const EVIDENCE_CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const
export type EvidenceConfidence = (typeof EVIDENCE_CONFIDENCE_LEVELS)[number]

export const DUE_STATES = ["CURRENT", "DUE", "OVERDUE"] as const
export type DueState = (typeof DUE_STATES)[number]

export type SkillDisplayStage = EvidenceStage | "REFRESH_DUE"

export interface ScheduleState {
  dueAt: Date
  intervalMinutes: number
  repetitions: number
  lapses: number
  version: number
  lastReviewedAt?: Date | null
}

export interface ScheduleTransition {
  algorithmVersion: string
  before: ScheduleState
  after: Required<ScheduleState>
}

export interface MasteryEvidenceInput {
  conceptVersionId: string
  kind?: string
  questionId?: string
  questionFamilyId?: string
  sessionId: string
  sessionCompletedAt: Date
  rating: ReviewRating
  weight: 0 | 0.5 | 1
  reviewDay: string
  occurredAt: Date
}

export interface ActiveConceptSchedule {
  conceptVersionId: string
  dueAt: Date
  intervalMinutes: number
}

export interface GoalSkillReadinessInput {
  requiredConceptVersionIds: readonly string[]
  activeQuestionConceptVersionIds: readonly string[]
  evidence: readonly MasteryEvidenceInput[]
  activeSchedules: readonly ActiveConceptSchedule[]
  computedAt: Date
}

export const MASTERY_REASON_CODES = [
  "NO_QUALIFYING_REVIEWS",
  "FIRST_REVIEW_RECORDED",
  "SCOPE_INCOMPLETE",
  "NEEDS_CONCEPT_SUCCESS",
  "NEEDS_SUCCESSFUL_FULL_WEIGHT_REVIEWS",
  "NEEDS_REVIEW_DAYS",
  "NEEDS_TIME_SPAN",
  "NEEDS_GOOD_OR_EASY_LATEST",
  "NEEDS_RECENT_PERFORMANCE",
  "NEEDS_STABLE_INTERVAL",
  "NEEDS_HIGH_CONFIDENCE",
  "NEEDS_TRANSFER_EVIDENCE",
  "LATEST_REVIEW_WAS_AGAIN",
  "DEMONSTRATED_REQUIREMENTS_MET",
  "WELL_LEARNED_REQUIREMENTS_MET",
] as const
export type MasteryReasonCode = (typeof MASTERY_REASON_CODES)[number]

export interface MasteryExplanationFacts {
  requiredConcepts: number
  coveredRequiredConcepts: number
  fullWeightReviews: number
  successfulFullWeightReviews: number
  distinctReviewDays: number
  spanDays: number
  completedSessions: number
  medianIntervalMinutes: number | null
  successfulTransferProbes: number
  transferReviewDays: number
}

export interface MasteryExplanation {
  reasons: MasteryReasonCode[]
  facts: MasteryExplanationFacts
}

export interface GoalSkillReadinessResult {
  milestone?: MasteryMilestone
  ruleVersion: string
  stage: EvidenceStage
  confidence: EvidenceConfidence
  scopeCoverage: number
  selfAssessedIndex: number | null
  recentThreeSessionIndex: number | null
  fullWeightReviews: number
  successfulFullWeightReviews: number
  distinctReviewDays: number
  spanDays: number
  completedSessions: number
  latestRating: ReviewRating | null
  earliestDueAt: Date | null
  medianIntervalMinutes: number | null
  successfulTransferProbes: number
  transferReviewDays: number
  explanation: MasteryExplanation
  computedAt: Date
}

export interface MasteryMilestone {
  ruleVersion: string
  requirements: Array<{ id: string; label: string; met: boolean; detail: string; next: string }>
}
