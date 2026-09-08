import { z } from "zod"
import type { VisibleInitialQuizQuestion } from "@/lib/ai/learning-pack-schema"

const assessment = z.enum(["MISSED", "PARTIAL", "MEETS"])
const answer = z.union([
  z.object({ questionIndex: z.number().int().min(0).max(5), response: z.object({ selectedChoiceIndex: z.number().int().min(0).max(3) }).strict() }).strict(),
  z.object({ questionIndex: z.number().int().min(0).max(5), response: z.object({ text: z.string().min(1).max(4000) }).strict(), assessment }).strict(),
])

export const quizDraftStateSchema = z.object({
  questionPosition: z.number().int().min(0).max(4),
  phase: z.enum(["answering", "feedback"]),
  selectedChoiceIndex: z.number().int().min(0).max(3).nullable(),
  shortResponse: z.string().max(4000),
  shortAssessment: assessment.nullable(),
  completedAnswers: z.array(answer).max(5),
  completedAt: z.string().datetime().nullable(),
}).strict()

export type QuizDraftState = z.infer<typeof quizDraftStateSchema>
export type QuizDraft = {
  attemptId: string
  startedAt: string
  version: number
  state: QuizDraftState
}
export const EMPTY_QUIZ_DRAFT: QuizDraftState = {
  questionPosition: 0, phase: "answering", selectedChoiceIndex: null,
  shortResponse: "", shortAssessment: null, completedAnswers: [], completedAt: null,
}

/** Drafts contain only learner input; never persist hidden transfer questions. */
export function validateQuizDraft(state: QuizDraftState, questions: readonly VisibleInitialQuizQuestion[]) {
  const count = state.completedAnswers.length
  const complete = state.completedAt !== null
  if (state.questionPosition >= questions.length ||
      (complete ? count !== questions.length || state.questionPosition !== questions.length - 1 : count !== state.questionPosition)) {
    throw new Error("The saved quiz position is invalid.")
  }
  for (const [position, response] of state.completedAnswers.entries()) {
    const item = questions[position]
    if (!item || response.questionIndex !== item.questionIndex || item.question.isTransferProbe ||
      (item.question.type === "MULTIPLE_CHOICE"
        ? !("selectedChoiceIndex" in response.response) || response.response.selectedChoiceIndex >= item.question.choices.length
        : !("text" in response.response) || !response.response.text.trim() || !("assessment" in response))) {
      throw new Error("The saved quiz answer is invalid.")
    }
  }
  const current = questions[state.questionPosition].question
  if (current.type === "MULTIPLE_CHOICE") {
    if (state.shortResponse || state.shortAssessment ||
      (state.selectedChoiceIndex !== null && state.selectedChoiceIndex >= current.choices.length) ||
      (state.phase === "feedback" && state.selectedChoiceIndex === null)) throw new Error("Choose a valid answer.")
  } else if (state.selectedChoiceIndex !== null ||
    (state.phase === "feedback" && !state.shortResponse.trim())) throw new Error("Enter a valid answer.")
  return state
}
