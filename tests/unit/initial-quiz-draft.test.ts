import { describe, expect, it } from "vitest"
import { EMPTY_QUIZ_DRAFT, quizDraftStateSchema, validateQuizDraft } from "@/lib/learning/initial-quiz-draft"
import type { VisibleInitialQuizQuestion } from "@/lib/ai/learning-pack-schema"

const questions: VisibleInitialQuizQuestion[] = [0, 1].map((index) => ({
  questionIndex: index,
  question: { competencyId: "keys", questionFamilyId: `family-${index}`, type: index ? "SHORT_RESPONSE" : "MULTIPLE_CHOICE",
    prompt: "Explain a map", choices: index ? [] : ["A", "B", "C", "D"], correctChoiceIndex: index ? null : 0,
    referenceAnswer: "Key-value pairs", explanation: "Maps associate keys and values", isTransferProbe: false,
    citation: { sourceId: "source", locator: "Notes", excerpt: "Maps store key-value pairs." } },
}))

describe("quiz draft integrity", () => {
  it("restores explicit skipped feedback and previous skipped questions", () => {
    const state = { ...EMPTY_QUIZ_DRAFT, questionPosition: 1, skipped: true, phase: "feedback" as const,
      completedAnswers: [{ questionIndex: 0, response: { skipped: true as const } }] }
    expect(validateQuizDraft(quizDraftStateSchema.parse(state), questions)).toEqual(state)
    expect(() => validateQuizDraft({ ...state, shortAssessment: "MEETS" }, questions)).toThrow("skipped")
    expect(() => validateQuizDraft({ ...state, shortResponse: "fabricated" }, questions)).toThrow("skipped")
    expect(() => validateQuizDraft({ ...state, phase: "answering" }, questions)).toThrow("skipped")
  })
  it("retains an unfinished answer and the exact feedback phase", () => {
    const state = { ...EMPTY_QUIZ_DRAFT, questionPosition: 1, shortResponse: "Keys have values", phase: "feedback" as const,
      completedAnswers: [{ questionIndex: 0, response: { selectedChoiceIndex: 0 } }] }
    expect(validateQuizDraft(quizDraftStateSchema.parse(state), questions)).toEqual(state)
  })
  it("rejects skipped questions and reserved-question answers", () => {
    expect(() => validateQuizDraft({ ...EMPTY_QUIZ_DRAFT, questionPosition: 1 }, questions)).toThrow("position")
    expect(() => validateQuizDraft({ ...EMPTY_QUIZ_DRAFT, questionPosition: 1,
      completedAnswers: [{ questionIndex: 5, response: { selectedChoiceIndex: 0 } }] }, questions)).toThrow("answer")
  })
  it("rejects revealed feedback without an answer", () => {
    expect(() => validateQuizDraft({ ...EMPTY_QUIZ_DRAFT, phase: "feedback" }, questions)).toThrow("answer")
  })
  it("keeps all completed input available for retry without creating evidence", () => {
    const state = { ...EMPTY_QUIZ_DRAFT, questionPosition: 1, phase: "feedback" as const, shortResponse: "Keys have values",
      shortAssessment: "MEETS" as const, completedAt: "2026-09-07T12:00:00.000Z",
      completedAnswers: [{ questionIndex: 0, response: { selectedChoiceIndex: 0 } },
        { questionIndex: 1, response: { text: "Keys have values" }, assessment: "MEETS" as const }] }
    expect(validateQuizDraft(quizDraftStateSchema.parse(state), questions)).toEqual(state)
  })
})
