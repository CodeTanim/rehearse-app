import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import type { LearningPack } from "@/lib/ai/learning-pack-schema"
import {
  buildRecallInventory,
  canonicalizeInitialQuizAnswers,
  InitialQuizServiceError,
  initialQuizAttemptSchema,
  validateInitialQuizTiming,
} from "@/lib/learning/initial-quiz-service"

const citation = {
  sourceId: "source-version-1",
  locator: "Notes · snapshot 1",
  excerpt: "Hash maps store key-value pairs.",
}

function pack(): LearningPack {
  const question = (
    prompt: string,
    type: "MULTIPLE_CHOICE" | "SHORT_RESPONSE",
    isTransferProbe = false,
  ): LearningPack["questions"][number] => ({
    competencyId: prompt.includes("collision") ? "collisions" : "storage",
    questionFamilyId: prompt.toLowerCase().replaceAll(/[^a-z]+/g, "-").replace(/^-|-$/g, ""),
    type,
    prompt,
    choices: type === "MULTIPLE_CHOICE" ? ["Pairs", "Rows", "Edges", "Pages"] : [],
    correctChoiceIndex: type === "MULTIPLE_CHOICE" ? 0 : null,
    referenceAnswer: "Pairs",
    explanation: "The source states this directly.",
    citation,
    isTransferProbe,
  })

  return {
    branch: "Data Structures",
    placementRationale: "Hash maps are a data structure.",
    competencies: [
      { id: "storage", title: "Storage" },
      { id: "collisions", title: "Collisions" },
    ],
    questions: [
      question("What is stored?", "MULTIPLE_CHOICE"),
      question("Explain a collision.", "SHORT_RESPONSE"),
      question("Name the stored unit.", "SHORT_RESPONSE"),
      question("Choose the stored unit.", "MULTIPLE_CHOICE"),
      question("Apply storage in a new case.", "SHORT_RESPONSE", true),
      question("Apply collision handling.", "MULTIPLE_CHOICE", true),
    ],
  }
}

function submittedAnswers() {
  const value = pack()
  return value.questions.slice(0, 4).map((question, questionIndex) => ({
    questionIndex,
    competencyId: question.competencyId,
    questionType: question.type,
    prompt: question.prompt,
    response:
      question.type === "MULTIPLE_CHOICE"
        ? { selectedChoiceIndex: questionIndex === 0 ? 0 : 1 }
        : { text: "My answer" },
    result:
      question.type === "MULTIPLE_CHOICE"
        ? {
            assessment: questionIndex === 0 ? ("MEETS" as const) : ("MISSED" as const),
            isCorrect: questionIndex === 0,
          }
        : { assessment: "PARTIAL" as const, isCorrect: null },
    referenceAnswer: question.referenceAnswer,
    explanation: question.explanation,
    citation: question.citation,
  }))
}

describe("initial quiz server validation", () => {
  it("accepts explicit unknown answers but rejects credit for them", () => {
    const answers = submittedAnswers().map((answer) => ({ ...answer, response: { skipped: true as const }, result: { assessment: "MISSED" as const, isCorrect: null } }))
    expect(canonicalizeInitialQuizAnswers(pack(), answers).every((answer) => "skipped" in answer.response)).toBe(true)
    expect(() => canonicalizeInitialQuizAnswers(pack(), answers.map((answer) => ({ ...answer, result: { assessment: "MEETS", isCorrect: null } })))).toThrow("cannot receive credit")
  })
  it("turns every pack question into recall inventory while staggering new angles", () => {
    const now = new Date("2026-09-04T12:00:00.000Z")
    const inventory = buildRecallInventory(pack(), "pack-version-1", now)

    expect(inventory).toHaveLength(6)
    expect(inventory.map((item) => item.role)).toEqual([
      "CORE",
      "CORE",
      "CORE",
      "CORE",
      "TRANSFER",
      "TRANSFER",
    ])
    expect(inventory.slice(0, 5).map((item) => item.dueAt.toISOString())).toEqual(
      Array(5).fill("2026-09-05T12:00:00.000Z"),
    )
    expect(inventory[5].dueAt.toISOString()).toBe("2026-09-06T12:00:00.000Z")
    expect(new Set(inventory.map((item) => item.questionId)).size).toBe(6)
    expect(inventory[0]).toMatchObject({
      responseType: "MULTIPLE_CHOICE",
      choices: ["Pairs", "Rows", "Edges", "Pages"],
      correctChoiceIndex: 0,
    })
  })

  it("recomputes multiple-choice results and keeps short-response assessment explicit", () => {
    const answers = canonicalizeInitialQuizAnswers(pack(), submittedAnswers())

    expect(answers.map((answer) => answer.result)).toEqual([
      { assessment: "MEETS", isCorrect: true },
      { assessment: "PARTIAL", isCorrect: null },
      { assessment: "PARTIAL", isCorrect: null },
      { assessment: "MISSED", isCorrect: false },
    ])
    expect(answers).toHaveLength(4)
  })

  it("rejects client-tampered grading or generated content", () => {
    const wrongGrade = submittedAnswers()
    wrongGrade[0] = {
      ...wrongGrade[0],
      result: { assessment: "MISSED", isCorrect: false },
    }
    expect(() => canonicalizeInitialQuizAnswers(pack(), wrongGrade)).toThrow(
      InitialQuizServiceError,
    )

    const changedPrompt = submittedAnswers()
    changedPrompt[1] = { ...changedPrompt[1], prompt: "A different prompt" }
    expect(() => canonicalizeInitialQuizAnswers(pack(), changedPrompt)).toThrow(
      "This quiz changed",
    )
  })

  it("rejects partial attempts, probe answers, and unknown payload fields", () => {
    expect(() => canonicalizeInitialQuizAnswers(pack(), submittedAnswers().slice(0, 3))).toThrow(
      "Complete every quiz question",
    )
    expect(() =>
      canonicalizeInitialQuizAnswers(pack(), [
        ...submittedAnswers(),
        { ...submittedAnswers()[0], questionIndex: 4 },
      ]),
    ).toThrow("Complete every quiz question")

    expect(() =>
      initialQuizAttemptSchema.parse({
        attemptId: "11111111-1111-4111-8111-111111111111",
        goalSkillId: "skill-1",
        packVersionId: "pack-1",
        startedAt: "2026-09-04T12:00:00.000Z",
        completedAt: "2026-09-04T12:05:00.000Z",
        answers: submittedAnswers(),
        userId: "must-not-be-client-controlled",
      }),
    ).toThrow()
  })

  it("accepts bounded timing and rejects stale or future attempts", () => {
    const now = new Date("2026-09-04T13:00:00.000Z")
    expect(() =>
      validateInitialQuizTiming(
        new Date("2026-09-04T12:00:00.000Z"),
        new Date("2026-09-04T12:30:00.000Z"),
        now,
      ),
    ).not.toThrow()

    expect(() =>
      validateInitialQuizTiming(
        new Date("2026-09-02T12:00:00.000Z"),
        new Date("2026-09-02T12:30:00.000Z"),
        now,
      ),
    ).toThrow("timing")
    expect(() =>
      validateInitialQuizTiming(
        new Date("2026-09-04T13:10:00.000Z"),
        new Date("2026-09-04T13:11:00.000Z"),
        now,
      ),
    ).toThrow("timing")
  })
})
