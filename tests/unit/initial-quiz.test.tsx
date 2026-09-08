import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  buildInitialQuizAttemptPayload,
  InitialQuiz,
  initialQuizAttemptsEndpoint,
  type InitialQuizAnswerInput,
} from "@/components/learning/initial-quiz"
import {
  visibleInitialQuizQuestions,
  type LearningPack,
} from "@/lib/ai/learning-pack-schema"

const citation = {
  sourceId: "source-notes",
  locator: "Notes · paragraph 1",
  excerpt: "A hash function maps a key to a bucket.",
}

function question(
  values: Partial<LearningPack["questions"][number]> &
    Pick<LearningPack["questions"][number], "prompt" | "type">,
): LearningPack["questions"][number] {
  const multipleChoice = values.type === "MULTIPLE_CHOICE"
  return {
    competencyId: values.competencyId ?? "hashing",
    questionFamilyId: values.questionFamilyId ?? `family-${values.prompt}`,
    type: values.type,
    prompt: values.prompt,
    choices: values.choices ??
      (multipleChoice ? ["Correct choice", "Choice two", "Choice three", "Choice four"] : []),
    correctChoiceIndex: values.correctChoiceIndex ?? (multipleChoice ? 0 : null),
    referenceAnswer: values.referenceAnswer ?? "Reference answer",
    explanation: values.explanation ?? "Concise source-grounded explanation.",
    citation: values.citation ?? citation,
    isTransferProbe: values.isTransferProbe ?? false,
  }
}

function packFixture(): LearningPack {
  return {
    branch: "Data Structures",
    placementRationale: "The topic belongs with data structures.",
    competencies: [
      { id: "hashing", title: "Hashing" },
      { id: "collisions", title: "Collisions" },
    ],
    questions: [
      question({
        type: "MULTIPLE_CHOICE",
        prompt: "What does the hash function choose?",
      }),
      question({
        type: "SHORT_RESPONSE",
        prompt: "Explain a collision.",
        competencyId: "collisions",
      }),
      question({
        type: "MULTIPLE_CHOICE",
        prompt: "Which lookup step comes first?",
        correctChoiceIndex: 1,
      }),
      question({
        type: "SHORT_RESPONSE",
        prompt: "Summarize key-to-bucket mapping.",
      }),
      question({
        type: "SHORT_RESPONSE",
        prompt: "Reserved transfer prompt one.",
        isTransferProbe: true,
      }),
      question({
        type: "MULTIPLE_CHOICE",
        prompt: "Reserved transfer prompt two.",
        competencyId: "collisions",
        isTransferProbe: true,
      }),
    ],
  }
}

function completeAnswers(): InitialQuizAnswerInput[] {
  return [
    { questionIndex: 0, response: { selectedChoiceIndex: 0 } },
    {
      questionIndex: 1,
      response: { text: "Two keys resolve to the same bucket." },
      assessment: "PARTIAL",
    },
    { questionIndex: 2, response: { selectedChoiceIndex: 0 } },
    {
      questionIndex: 3,
      response: { text: "The key is mapped to a bucket." },
      assessment: "MEETS",
    },
  ]
}

describe("InitialQuiz", () => {
  it("renders one initial question and never exposes reserved transfer probes", () => {
    const html = renderToStaticMarkup(
      createElement(InitialQuiz, {
        goalSkillId: "skill-1",
        packVersionId: "pack-1",
        questions: visibleInitialQuizQuestions(packFixture()),
      }),
    )

    expect(html).toContain("What does the hash function choose?")
    expect(html).toContain("Correct choice")
    expect(html).toContain("1 / 4")
    expect(html).toContain("Question 1 of 4")
    expect(html).not.toContain("Explain a collision.")
    expect(html).not.toContain("Reserved transfer prompt")
    expect(html).not.toContain("Reference answer")
  })

  it("builds a frozen, complete payload in pack order with deterministic results", () => {
    const payload = buildInitialQuizAttemptPayload({
      attemptId: "attempt-1",
      goalSkillId: "skill-1",
      packVersionId: "pack-1",
      startedAt: "2026-09-04T12:00:00.000Z",
      completedAt: "2026-09-04T12:05:00.000Z",
      questions: visibleInitialQuizQuestions(packFixture()),
      answers: completeAnswers().toReversed(),
    })

    expect(payload.answers.map((answer) => answer.questionIndex)).toEqual([0, 1, 2, 3])
    expect(payload.answers[0]?.result).toEqual({ assessment: "MEETS", isCorrect: true })
    expect(payload.answers[1]?.result).toEqual({ assessment: "PARTIAL", isCorrect: null })
    expect(payload.answers[2]?.result).toEqual({ assessment: "MISSED", isCorrect: false })
    expect(payload.answers.map((answer) => answer.prompt).join(" ")).not.toContain("Reserved")
    expect(Object.isFrozen(payload)).toBe(true)
    expect(Object.isFrozen(payload.answers)).toBe(true)
    expect(payload.answers.every((answer) => Object.isFrozen(answer))).toBe(true)
    expect(payload.answers.every((answer) => Object.isFrozen(answer.citation))).toBe(true)
  })

  it("rejects partial attempts and any answer for a transfer probe", () => {
    const base = {
      attemptId: "attempt-1",
      goalSkillId: "skill-1",
      packVersionId: "pack-1",
      startedAt: "2026-09-04T12:00:00.000Z",
      completedAt: "2026-09-04T12:05:00.000Z",
      questions: visibleInitialQuizQuestions(packFixture()),
    }

    expect(() =>
      buildInitialQuizAttemptPayload({
        ...base,
        answers: completeAnswers().slice(0, 3),
      }),
    ).toThrow("Complete every initial quiz question")

    expect(() =>
      buildInitialQuizAttemptPayload({
        ...base,
        answers: [
          ...completeAnswers(),
          {
            questionIndex: 4,
            response: { text: "A probe answer that must not be accepted." },
            assessment: "MEETS",
          },
        ],
      }),
    ).toThrow("Only initial quiz questions")
  })

  it("uses the documented, encoded attempt endpoint", () => {
    expect(initialQuizAttemptsEndpoint("pack/version one")).toBe(
      "/api/learning-packs/pack%2Fversion%20one/attempts",
    )
  })
})
