import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  saveCheckpoint: vi.fn(),
  reveal: vi.fn(),
  grade: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/learning/practice-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/learning/practice-service")>()
  return {
    ...original,
    practiceService: {
      saveCheckpoint: mocks.saveCheckpoint,
      reveal: mocks.reveal,
      grade: mocks.grade,
    },
  }
})

import { PATCH as saveCheckpoint } from "@/app/api/practice/items/[itemId]/checkpoint/route"
import { POST as grade } from "@/app/api/practice/items/[itemId]/grade/route"
import { POST as reveal } from "@/app/api/practice/items/[itemId]/reveal/route"
import { PracticeServiceError } from "@/lib/learning/practice-service"

const context = { params: Promise.resolve({ itemId: "item-a" }) }
const IDEMPOTENCY_KEY = "a5a80d74-e1e8-45af-b68b-9ca31624676e"

function jsonRequest(path: string, method: "PATCH" | "POST", body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("practice route contracts", () => {
  it("only accepts an empty reveal with an explicit skip flag", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-a" } })
    const path = "/api/practice/items/item-a/reveal"
    expect((await reveal(jsonRequest(path, "POST", { answer: "", expectedVersion: 2 }), context)).status).toBe(400)
    expect(mocks.reveal).not.toHaveBeenCalled()
    mocks.reveal.mockResolvedValue({ checkpoint: { lockedAnswer: "", phase: "REVEALED", version: 3 }, referenceAnswer: "Reference" })
    expect((await reveal(jsonRequest(path, "POST", { answer: "", skipped: true, expectedVersion: 2 }), context)).status).toBe(200)
    expect(mocks.reveal).toHaveBeenCalledWith({ userId: "user-a", itemId: "item-a", answer: "", skipped: true, expectedVersion: 2 })
  })

  it("passes the explicit short-answer assessment to the grading service", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-a" } })
    mocks.grade.mockResolvedValue({ assessment: "PARTIAL", rating: "AGAIN" })
    await grade(jsonRequest("/api/practice/items/item-a/grade", "POST", { rating: "AGAIN", assessment: "PARTIAL", expectedVersion: 2, idempotencyKey: IDEMPOTENCY_KEY }), context)
    expect(mocks.grade).toHaveBeenCalledWith(expect.objectContaining({ assessment: "PARTIAL", rating: "AGAIN" }))
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "user-a" } })
  })

  it("requires authentication before reading a checkpoint request", async () => {
    mocks.auth.mockResolvedValue(null)
    const request = jsonRequest(
      "/api/practice/items/item-a/checkpoint",
      "PATCH",
      { answer: "answer", expectedVersion: 0 },
    )
    const jsonSpy = vi.spyOn(request, "json")

    const response = await saveCheckpoint(request, context)

    expect(response.status).toBe(401)
    expect(jsonSpy).not.toHaveBeenCalled()
    expect(mocks.saveCheckpoint).not.toHaveBeenCalled()
  })

  it("returns the saved checkpoint in a stable envelope", async () => {
    mocks.saveCheckpoint.mockResolvedValue({
      phase: "DRAFTING",
      draftAnswer: "A durable answer",
      version: 3,
    })

    const response = await saveCheckpoint(
      jsonRequest("/api/practice/items/item-a/checkpoint", "PATCH", {
        answer: "A durable answer",
        expectedVersion: 2,
      }),
      context,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      checkpoint: {
        phase: "DRAFTING",
        draftAnswer: "A durable answer",
        version: 3,
      },
    })
    expect(mocks.saveCheckpoint).toHaveBeenCalledWith({
      userId: "user-a",
      itemId: "item-a",
      answer: "A durable answer",
      expectedVersion: 2,
    })
  })

  it("returns the latest checkpoint with a 409 conflict", async () => {
    mocks.saveCheckpoint.mockRejectedValue(
      new PracticeServiceError(
        "This answer changed in another tab.",
        "CHECKPOINT_VERSION_CONFLICT",
        409,
        { phase: "DRAFTING", draftAnswer: "latest", version: 4 },
      ),
    )

    const response = await saveCheckpoint(
      jsonRequest("/api/practice/items/item-a/checkpoint", "PATCH", {
        answer: "stale",
        expectedVersion: 2,
      }),
      context,
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "This answer changed in another tab.",
      code: "CHECKPOINT_VERSION_CONFLICT",
      checkpoint: { phase: "DRAFTING", draftAnswer: "latest", version: 4 },
    })
  })

  it("preserves the exact validated answer when revealing", async () => {
    const exactAnswer = "  my answer with intentional spacing  "
    mocks.reveal.mockResolvedValue({
      checkpoint: {
        phase: "REVEALED",
        lockedAnswer: exactAnswer,
        version: 3,
        revealedAt: "2026-09-02T16:00:00.000Z",
      },
      referenceAnswer: "Reference",
    })

    const response = await reveal(
      jsonRequest("/api/practice/items/item-a/reveal", "POST", {
        answer: exactAnswer,
        expectedVersion: 2,
      }),
      context,
    )

    expect(response.status).toBe(200)
    expect(mocks.reveal).toHaveBeenCalledWith({
      userId: "user-a",
      itemId: "item-a",
      answer: exactAnswer,
      expectedVersion: 2,
    })
    await expect(response.json()).resolves.toMatchObject({
      referenceAnswer: "Reference",
      checkpoint: { lockedAnswer: exactAnswer },
    })
  })

  it("does not call reveal or expose a reference for a blank answer", async () => {
    const response = await reveal(
      jsonRequest("/api/practice/items/item-a/reveal", "POST", {
        answer: "   ",
        expectedVersion: 2,
      }),
      context,
    )

    expect(response.status).toBe(400)
    expect(mocks.reveal).not.toHaveBeenCalled()
    const body = await response.json()
    expect(body).not.toHaveProperty("referenceAnswer")
  })

  it("bounds the exact reveal payload before locking it", async () => {
    const response = await reveal(
      jsonRequest("/api/practice/items/item-a/reveal", "POST", {
        answer: `${" ".repeat(10_000)}answer`,
        expectedVersion: 2,
      }),
      context,
    )

    expect(response.status).toBe(400)
    expect(mocks.reveal).not.toHaveBeenCalled()
  })

  it("passes only the self-grade contract to the trusted service", async () => {
    const summary = {
      skillTitle: "Cache invalidation",
      stageBefore: "UNASSESSED",
      stageAfter: "LEARNING",
      confidence: "LOW",
      nextReviewAt: "2026-09-03T16:00:00.000Z",
      reason: "First recall saved.",
      dueState: "CURRENT",
    }
    mocks.grade.mockResolvedValue(summary)

    const response = await grade(
      jsonRequest("/api/practice/items/item-a/grade", "POST", {
        rating: "GOOD",
        idempotencyKey: IDEMPOTENCY_KEY,
        expectedVersion: 3,
        stageAfter: "WELL_LEARNED",
        nextReviewAt: "2099-01-01T00:00:00.000Z",
        normalizedScore: 1,
        evidenceWeight: 100,
      }),
      context,
    )

    expect(response.status).toBe(200)
    expect(mocks.grade).toHaveBeenCalledWith({
      userId: "user-a",
      itemId: "item-a",
      rating: "GOOD",
      idempotencyKey: IDEMPOTENCY_KEY,
      expectedVersion: 3,
    })
    await expect(response.json()).resolves.toEqual({ summary })
  })

  it("rejects invalid grades and malformed JSON", async () => {
    const invalidGrade = await grade(
      jsonRequest("/api/practice/items/item-a/grade", "POST", {
        rating: "PERFECT",
        idempotencyKey: IDEMPOTENCY_KEY,
        expectedVersion: 3,
      }),
      context,
    )
    expect(invalidGrade.status).toBe(400)

    const malformed = new NextRequest(
      "http://localhost/api/practice/items/item-a/checkpoint",
      { method: "PATCH", body: "{not-json", headers: { "content-type": "application/json" } },
    )
    const malformedResponse = await saveCheckpoint(malformed, context)
    expect(malformedResponse.status).toBe(400)
    await expect(malformedResponse.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
    })
    expect(mocks.grade).not.toHaveBeenCalled()
    expect(mocks.saveCheckpoint).not.toHaveBeenCalled()
  })

  it("maps missing and foreign-owned items to the same 404 response", async () => {
    mocks.grade.mockRejectedValue(
      new PracticeServiceError(
        "Practice item not found.",
        "PRACTICE_NOT_FOUND",
        404,
      ),
    )

    const response = await grade(
      jsonRequest("/api/practice/items/item-a/grade", "POST", {
        rating: "GOOD",
        idempotencyKey: IDEMPOTENCY_KEY,
        expectedVersion: 3,
      }),
      context,
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Practice item not found.",
      code: "PRACTICE_NOT_FOUND",
    })
  })
})
