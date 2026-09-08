import { describe, expect, it } from "vitest"
import {
  goalSetupSchema,
  gradeSchema,
  questionSetupSchema,
  revealSchema,
  skillSetupSchema,
} from "@/lib/learning/validation"
import { slugify } from "@/lib/learning/slug"

describe("manual learning setup validation", () => {
  it("accepts the complete three-step setup", () => {
    expect(goalSetupSchema.safeParse({ title: "Caching", outcome: "Design a cache" }).success).toBe(true)
    expect(
      skillSetupSchema.safeParse({
        title: "Cache invalidation",
        outcome: "Explain safe invalidation",
        successCriterion: "Compare two strategies with tradeoffs",
      }).success,
    ).toBe(true)
    expect(
      questionSetupSchema.safeParse({ prompt: "What can go stale?", referenceAnswer: "Cached data." }).success,
    ).toBe(true)
  })

  it("requires a pre-reveal answer and a server-approved rating", () => {
    expect(revealSchema.safeParse({ answer: "   ", expectedVersion: 0 }).success).toBe(false)
    expect(
      gradeSchema.safeParse({
        rating: "PERFECT",
        idempotencyKey: "a5a80d74-e1e8-45af-b68b-9ca31624676e",
        expectedVersion: 1,
      }).success,
    ).toBe(false)
  })

  it("creates readable slugs and a safe fallback", () => {
    expect(slugify("  Résilient API design! ")).toBe("resilient-api-design")
    expect(slugify("学ぶ")).toBe("skill")
  })
})
