import { describe, expect, it } from "vitest"

import {
  deriveDueState,
  getRatingScore,
  SCHEDULE_ALGORITHM_VERSION,
  scheduleNextReview,
} from "@/lib/learning/schedule"
import type { ReviewRating, ScheduleState } from "@/lib/learning/types"

const DAY = 24 * 60
const occurredAt = new Date("2026-01-01T12:00:00.000Z")

function schedule(overrides: Partial<ScheduleState> = {}): ScheduleState {
  return {
    dueAt: new Date("2026-01-01T11:00:00.000Z"),
    intervalMinutes: 0,
    repetitions: 0,
    lapses: 0,
    version: 0,
    lastReviewedAt: null,
    ...overrides,
  }
}

describe("schedule-v1", () => {
  it.each([
    ["AGAIN", 0, 10, 0, 1],
    ["HARD", 0.6, DAY, 1, 0],
    ["GOOD", 0.85, DAY, 1, 0],
    ["EASY", 1, 4 * DAY, 1, 0],
  ] as const)(
    "maps %s to its documented score and first interval",
    (rating, score, intervalMinutes, repetitions, lapses) => {
      const result = scheduleNextReview({ current: schedule(), rating, occurredAt })

      expect(getRatingScore(rating)).toBe(score)
      expect(result.algorithmVersion).toBe(SCHEDULE_ALGORITHM_VERSION)
      expect(result.after).toMatchObject({ intervalMinutes, repetitions, lapses, version: 1 })
      expect(result.after.dueAt.toISOString()).toBe(
        new Date(occurredAt.getTime() + intervalMinutes * 60_000).toISOString(),
      )
    },
  )

  it.each([
    ["HARD", 3 * DAY, 2, 5_184],
    ["GOOD", DAY, 1, 3 * DAY],
    ["GOOD", 3 * DAY, 2, 6 * DAY],
    ["EASY", 4 * DAY, 1, 12 * DAY],
  ] as const)(
    "advances an established schedule after %s",
    (rating, intervalMinutes, repetitions, expectedMinutes) => {
      const result = scheduleNextReview({
        current: schedule({ intervalMinutes, repetitions, lapses: 2, version: 7 }),
        rating,
        occurredAt,
      })

      expect(result.after).toMatchObject({
        intervalMinutes: expectedMinutes,
        repetitions: repetitions + 1,
        lapses: 2,
        version: 8,
      })
    },
  )

  it("resets repetitions and schedules a short retry after a lapse", () => {
    const result = scheduleNextReview({
      current: schedule({ intervalMinutes: 30 * DAY, repetitions: 8, lapses: 2 }),
      rating: "AGAIN",
      occurredAt,
    })

    expect(result.after).toMatchObject({ intervalMinutes: 10, repetitions: 0, lapses: 3 })
  })

  it("caps long successful intervals at one year", () => {
    const result = scheduleNextReview({
      current: schedule({ intervalMinutes: 300 * DAY, repetitions: 9 }),
      rating: "EASY",
      occurredAt,
    })

    expect(result.after.intervalMinutes).toBe(365 * DAY)
  })

  it("does not mutate the saved schedule", () => {
    const current = schedule({ lastReviewedAt: new Date("2025-12-20T12:00:00.000Z") })
    const originalDueTime = current.dueAt.getTime()
    const originalReviewTime = current.lastReviewedAt?.getTime()

    const result = scheduleNextReview({ current, rating: "GOOD", occurredAt })

    expect(current.dueAt.getTime()).toBe(originalDueTime)
    expect(current.lastReviewedAt?.getTime()).toBe(originalReviewTime)
    expect(result.before.dueAt).not.toBe(current.dueAt)
    expect(result.after.lastReviewedAt).not.toBe(occurredAt)
  })

  it.each([
    ["2026-01-02T00:00:00.001Z", "2026-01-02T00:00:00.000Z", "CURRENT"],
    ["2026-01-02T00:00:00.000Z", "2026-01-02T00:00:00.000Z", "DUE"],
    ["2026-01-02T00:00:00.000Z", "2026-01-02T23:59:59.999Z", "DUE"],
    ["2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z", "OVERDUE"],
  ] as const)("derives %s / %s as %s", (dueAt, now, expected) => {
    expect(deriveDueState(new Date(dueAt), new Date(now))).toBe(expected)
  })

  it.each([
    [schedule({ intervalMinutes: -1 }), "GOOD"],
    [schedule({ repetitions: 1.5 }), "GOOD"],
    [schedule({ dueAt: new Date("invalid") }), "GOOD"],
  ] as [ScheduleState, ReviewRating][])("rejects an invalid persisted state", (current, rating) => {
    expect(() => scheduleNextReview({ current, rating, occurredAt })).toThrow(RangeError)
  })
})
