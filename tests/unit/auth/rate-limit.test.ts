import { describe, expect, it } from "vitest"
import {
  consumeRateLimit,
  getClientIdentifier,
  resetRateLimit,
} from "@/lib/auth/rate-limit"

describe("authentication rate limiting", () => {
  it("blocks attempts after the configured limit and reports the retry window", () => {
    const scope = `test-${crypto.randomUUID()}`
    const policy = { limit: 2, windowMs: 60_000 }

    expect(consumeRateLimit({ scope, identifier: "client", policy, now: 1_000 })).toMatchObject({
      allowed: true,
      remaining: 1,
    })
    expect(consumeRateLimit({ scope, identifier: "client", policy, now: 2_000 })).toMatchObject({
      allowed: true,
      remaining: 0,
    })
    expect(consumeRateLimit({ scope, identifier: "client", policy, now: 3_000 })).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 58,
    })
  })

  it("starts a fresh bucket after the window expires", () => {
    const scope = `test-${crypto.randomUUID()}`
    const policy = { limit: 1, windowMs: 1_000 }

    expect(consumeRateLimit({ scope, identifier: "client", policy, now: 5_000 }).allowed).toBe(true)
    expect(consumeRateLimit({ scope, identifier: "client", policy, now: 5_500 }).allowed).toBe(false)
    expect(consumeRateLimit({ scope, identifier: "client", policy, now: 6_000 }).allowed).toBe(true)
  })

  it("can clear a principal bucket after a successful sign-in", () => {
    const scope = `test-${crypto.randomUUID()}`
    const identifier = "learner@example.com"
    const policy = { limit: 1, windowMs: 60_000 }

    expect(consumeRateLimit({ scope, identifier, policy, now: 1_000 }).allowed).toBe(true)
    expect(consumeRateLimit({ scope, identifier, policy, now: 2_000 }).allowed).toBe(false)

    resetRateLimit({ scope, identifier })

    expect(consumeRateLimit({ scope, identifier, policy, now: 3_000 }).allowed).toBe(true)
  })

  it("prefers the first forwarded address and has a bounded fallback", () => {
    expect(getClientIdentifier(new Headers({ "x-forwarded-for": "203.0.113.4, 10.0.0.1" }))).toBe("203.0.113.4")
    expect(getClientIdentifier(new Headers())).toBe("unknown-client")
  })
})
