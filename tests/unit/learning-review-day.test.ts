import { describe, expect, it } from "vitest"

import {
  differenceInReviewDays,
  isValidTimeZone,
  toReviewDay,
} from "@/lib/learning/review-day"

describe("learner-local review days", () => {
  it.each([
    ["2026-03-08T04:59:59.000Z", "America/New_York", "2026-03-07"],
    ["2026-03-08T05:00:00.000Z", "America/New_York", "2026-03-08"],
    ["2026-11-01T03:59:59.000Z", "America/New_York", "2026-10-31"],
    ["2026-11-01T04:00:00.000Z", "America/New_York", "2026-11-01"],
    ["2026-01-01T14:59:59.000Z", "Asia/Tokyo", "2026-01-01"],
    ["2026-01-01T15:00:00.000Z", "Asia/Tokyo", "2026-01-02"],
  ])("maps %s in %s to %s", (instant, timeZone, expected) => {
    expect(toReviewDay(new Date(instant), timeZone)).toBe(expected)
  })

  it("recognizes IANA timezones and rejects unsafe values", () => {
    expect(isValidTimeZone("UTC")).toBe(true)
    expect(isValidTimeZone("America/New_York")).toBe(true)
    expect(isValidTimeZone("Not/A_Timezone")).toBe(false)
    expect(isValidTimeZone("x".repeat(101))).toBe(false)
  })

  it("counts calendar-day span independently of daylight-saving duration", () => {
    expect(differenceInReviewDays("2026-03-07", "2026-03-09")).toBe(2)
    expect(differenceInReviewDays("2026-11-01", "2026-11-15")).toBe(14)
  })

  it.each(["2026-02-30", "01/01/2026", "2026-1-01"])(
    "rejects invalid review day %s",
    (reviewDay) => {
      expect(() => differenceInReviewDays(reviewDay, reviewDay)).toThrow(RangeError)
    },
  )

  it("rejects invalid dates and timezones", () => {
    expect(() => toReviewDay(new Date("invalid"), "UTC")).toThrow(RangeError)
    expect(() => toReviewDay(new Date(), "Private/Nowhere")).toThrow(RangeError)
  })
})
