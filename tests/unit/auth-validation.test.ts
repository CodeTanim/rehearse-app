import { describe, expect, it } from "vitest"
import { registerSchema } from "@/lib/auth/validation"

const validRegistration = {
  name: "Test Learner",
  email: "learner@example.com",
  password: "RehearseTest!2026",
}

describe("registration timezone", () => {
  it("accepts a supported browser timezone", () => {
    const parsed = registerSchema.parse({
      ...validRegistration,
      timezone: "America/New_York",
    })

    expect(parsed.timezone).toBe("America/New_York")
  })

  it("rejects an invented timezone", () => {
    expect(
      registerSchema.safeParse({ ...validRegistration, timezone: "Mars/Olympus" }).success,
    ).toBe(false)
  })
})
