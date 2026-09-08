import type {
  DueState,
  ReviewRating,
  ScheduleState,
  ScheduleTransition,
} from "@/lib/learning/types"
import { REVIEW_RATINGS } from "@/lib/learning/types"

export const SCHEDULE_ALGORITHM_VERSION = "schedule-v1"

export const RATING_SCORES: Readonly<Record<ReviewRating, number>> = {
  AGAIN: 0,
  HARD: 0.6,
  GOOD: 0.85,
  EASY: 1,
}

const MINUTES_PER_DAY = 24 * 60
const AGAIN_INTERVAL_MINUTES = 10
const MAX_INTERVAL_MINUTES = 365 * MINUTES_PER_DAY
const OVERDUE_AFTER_MS = 24 * 60 * 60 * 1000

export interface ScheduleNextReviewInput {
  current: ScheduleState
  rating: ReviewRating
  occurredAt: Date
}

function assertValidDate(value: Date, field: string) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new RangeError(`${field} must be a valid Date.`)
  }
}

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative integer.`)
  }
}

function clampInterval(minutes: number) {
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(1, Math.round(minutes)))
}

function successfulInterval(current: ScheduleState, rating: Exclude<ReviewRating, "AGAIN">) {
  if (rating === "HARD") {
    return current.repetitions === 0
      ? MINUTES_PER_DAY
      : Math.max(MINUTES_PER_DAY, clampInterval(current.intervalMinutes * 1.2))
  }

  if (rating === "GOOD") {
    if (current.repetitions === 0) return MINUTES_PER_DAY
    if (current.repetitions === 1) return 3 * MINUTES_PER_DAY
    return Math.max(3 * MINUTES_PER_DAY, clampInterval(current.intervalMinutes * 2))
  }

  return current.repetitions === 0
    ? 4 * MINUTES_PER_DAY
    : Math.max(7 * MINUTES_PER_DAY, clampInterval(current.intervalMinutes * 3))
}

/**
 * Deterministic pilot scheduler. It deliberately accepts no client-computed
 * score, interval, or due date; callers provide only the saved state, rating,
 * and server-owned occurrence time.
 */
export function scheduleNextReview({
  current,
  rating,
  occurredAt,
}: ScheduleNextReviewInput): ScheduleTransition {
  assertValidDate(current.dueAt, "current.dueAt")
  assertValidDate(occurredAt, "occurredAt")
  if (current.lastReviewedAt) assertValidDate(current.lastReviewedAt, "current.lastReviewedAt")
  if (!REVIEW_RATINGS.includes(rating)) throw new RangeError("rating is not supported.")
  assertNonNegativeInteger(current.intervalMinutes, "current.intervalMinutes")
  assertNonNegativeInteger(current.repetitions, "current.repetitions")
  assertNonNegativeInteger(current.lapses, "current.lapses")
  assertNonNegativeInteger(current.version, "current.version")

  const before: ScheduleState = {
    ...current,
    dueAt: new Date(current.dueAt),
    lastReviewedAt: current.lastReviewedAt ? new Date(current.lastReviewedAt) : null,
  }

  const isLapse = rating === "AGAIN"
  const intervalMinutes = isLapse
    ? AGAIN_INTERVAL_MINUTES
    : successfulInterval(current, rating)
  const dueAt = new Date(occurredAt.getTime() + intervalMinutes * 60_000)

  return {
    algorithmVersion: SCHEDULE_ALGORITHM_VERSION,
    before,
    after: {
      dueAt,
      intervalMinutes,
      repetitions: isLapse ? 0 : current.repetitions + 1,
      lapses: isLapse ? current.lapses + 1 : current.lapses,
      version: current.version + 1,
      lastReviewedAt: new Date(occurredAt),
    },
  }
}

export function getRatingScore(rating: ReviewRating) {
  return RATING_SCORES[rating]
}

export function deriveDueState(dueAt: Date, now: Date): DueState {
  assertValidDate(dueAt, "dueAt")
  assertValidDate(now, "now")

  const millisecondsLate = now.getTime() - dueAt.getTime()
  if (millisecondsLate < 0) return "CURRENT"
  if (millisecondsLate < OVERDUE_AFTER_MS) return "DUE"
  return "OVERDUE"
}
