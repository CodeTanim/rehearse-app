import { createHash } from "node:crypto"

type Bucket = {
  count: number
  resetAt: number
}

type RateLimitStore = typeof globalThis & {
  __rehearseAuthRateLimitBuckets?: Map<string, Bucket>
}

export type RateLimitPolicy = {
  limit: number
  windowMs: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export const AUTH_RATE_LIMITS = {
  loginByClient: { limit: 30, windowMs: 15 * 60 * 1_000 },
  loginByPrincipal: { limit: 10, windowMs: 15 * 60 * 1_000 },
  registrationByClient: { limit: 5, windowMs: 60 * 60 * 1_000 },
} satisfies Record<string, RateLimitPolicy>

const MAX_BUCKETS = 5_000
const rateLimitStore = globalThis as RateLimitStore
const buckets = rateLimitStore.__rehearseAuthRateLimitBuckets ?? new Map<string, Bucket>()

rateLimitStore.__rehearseAuthRateLimitBuckets = buckets

function opaqueKey(scope: string, identifier: string) {
  return createHash("sha256")
    .update(`${scope}\0${identifier}`)
    .digest("base64url")
}

function pruneBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }

  while (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value
    if (typeof oldestKey !== "string") break
    buckets.delete(oldestKey)
  }
}

export function getClientIdentifier(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const direct = headers.get("x-real-ip")?.trim()
  return (forwarded || direct || "unknown-client").slice(0, 128)
}

export function consumeRateLimit({
  scope,
  identifier,
  policy,
  now = Date.now(),
}: {
  scope: string
  identifier: string
  policy: RateLimitPolicy
  now?: number
}): RateLimitResult {
  pruneBuckets(now)

  const key = opaqueKey(scope, identifier)
  const existing = buckets.get(key)
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + policy.windowMs }
    : existing

  if (bucket.count >= policy.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    }
  }

  bucket.count += 1
  buckets.delete(key)
  buckets.set(key, bucket)

  return {
    allowed: true,
    remaining: Math.max(0, policy.limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
  }
}

export function resetRateLimit({
  scope,
  identifier,
}: {
  scope: string
  identifier: string
}): void {
  buckets.delete(opaqueKey(scope, identifier))
}
