"use client"

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import { Textarea } from "@/components/ui/textarea"
import { useQuizDraft } from "@/hooks/use-quiz-draft"
import type { QuizDraft, QuizDraftState } from "@/lib/learning/initial-quiz-draft"
import {
  type LearningPack,
  type VisibleInitialQuizQuestion,
} from "@/lib/ai/learning-pack-schema"

export type InitialQuizAssessment = "MISSED" | "PARTIAL" | "MEETS"

type MultipleChoiceAnswerInput = Readonly<{
  questionIndex: number
  response: Readonly<{ selectedChoiceIndex: number }>
}>

type ShortResponseAnswerInput = Readonly<{
  questionIndex: number
  response: Readonly<{ text: string }>
  assessment: InitialQuizAssessment
}>

export type InitialQuizAnswerInput =
  | MultipleChoiceAnswerInput
  | ShortResponseAnswerInput

type AttemptAnswer = Readonly<{
  questionIndex: number
  competencyId: string
  questionType: "MULTIPLE_CHOICE" | "SHORT_RESPONSE"
  prompt: string
  response:
    | Readonly<{ selectedChoiceIndex: number }>
    | Readonly<{ text: string }>
  result: Readonly<{
    assessment: InitialQuizAssessment
    isCorrect: boolean | null
  }>
  referenceAnswer: string
  explanation: string
  citation: Readonly<{
    sourceId: string
    locator: string
    excerpt: string
  }>
}>

/**
 * Immutable request body for:
 * POST /api/learning-packs/[packVersionId]/attempts
 *
 * The server must authenticate the request, verify ownership and pack contents,
 * recompute deterministic results, and deduplicate retries by attemptId.
 */
export type InitialQuizAttemptPayload = Readonly<{
  attemptId: string
  goalSkillId: string
  packVersionId: string
  startedAt: string
  completedAt: string
  answers: readonly AttemptAnswer[]
}>

type InitialQuizProps = {
  initialDraft?: QuizDraft
  goalSkillId: string
  packVersionId: string
  questions: readonly VisibleInitialQuizQuestion[]
}

type QuizPhase = "answering" | "feedback"
type SubmissionState = "idle" | "submitting" | "error" | "complete"

function isMultipleChoiceAnswer(
  answer: InitialQuizAnswerInput,
): answer is MultipleChoiceAnswerInput {
  return "selectedChoiceIndex" in answer.response
}

function freezeAttemptAnswer(answer: AttemptAnswer): AttemptAnswer {
  Object.freeze(answer.response)
  Object.freeze(answer.result)
  Object.freeze(answer.citation)
  return Object.freeze(answer)
}

/** Builds the exact completion payload and fails closed on partial or probe data. */
export function buildInitialQuizAttemptPayload(input: {
  attemptId: string
  goalSkillId: string
  packVersionId: string
  startedAt: string
  completedAt: string
  questions: readonly VisibleInitialQuizQuestion[]
  answers: readonly InitialQuizAnswerInput[]
}): InitialQuizAttemptPayload {
  const answerByQuestionIndex = new Map<number, InitialQuizAnswerInput>()

  for (const answer of input.answers) {
    if (answerByQuestionIndex.has(answer.questionIndex)) {
      throw new Error("Each initial question can only be answered once.")
    }
    answerByQuestionIndex.set(answer.questionIndex, answer)
  }

  const answers = input.questions.map(({ question, questionIndex }) => {
    const answer = answerByQuestionIndex.get(questionIndex)

    if (!answer || questionIndex < 0 || question.isTransferProbe) {
      throw new Error("Complete every initial quiz question before saving.")
    }

    if (question.type === "MULTIPLE_CHOICE") {
      if (!isMultipleChoiceAnswer(answer)) {
        throw new Error("The answer type does not match the generated question.")
      }

      const selectedChoiceIndex = answer.response.selectedChoiceIndex
      if (
        !Number.isInteger(selectedChoiceIndex) ||
        selectedChoiceIndex < 0 ||
        selectedChoiceIndex >= question.choices.length ||
        question.correctChoiceIndex === null
      ) {
        throw new Error("Choose a valid answer before saving.")
      }

      const isCorrect = selectedChoiceIndex === question.correctChoiceIndex
      return freezeAttemptAnswer({
        questionIndex,
        competencyId: question.competencyId,
        questionType: question.type,
        prompt: question.prompt,
        response: Object.freeze({ selectedChoiceIndex }),
        result: Object.freeze({
          assessment: isCorrect ? "MEETS" : "MISSED",
          isCorrect,
        }),
        referenceAnswer: question.referenceAnswer,
        explanation: question.explanation,
        citation: Object.freeze({ ...question.citation }),
      })
    }

    if (isMultipleChoiceAnswer(answer) || !answer.response.text.trim()) {
      throw new Error("The answer type does not match the generated question.")
    }

    return freezeAttemptAnswer({
      questionIndex,
      competencyId: question.competencyId,
      questionType: question.type,
      prompt: question.prompt,
      response: Object.freeze({ text: answer.response.text }),
      result: Object.freeze({
        assessment: answer.assessment,
        isCorrect: null,
      }),
      referenceAnswer: question.referenceAnswer,
      explanation: question.explanation,
      citation: Object.freeze({ ...question.citation }),
    })
  })

  if (answerByQuestionIndex.size !== answers.length) {
    throw new Error("Only initial quiz questions can be saved in this attempt.")
  }

  return Object.freeze({
    attemptId: input.attemptId,
    goalSkillId: input.goalSkillId,
    packVersionId: input.packVersionId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    answers: Object.freeze(answers),
  })
}

export function initialQuizAttemptsEndpoint(packVersionId: string) {
  return `/api/learning-packs/${encodeURIComponent(packVersionId)}/attempts`
}

async function responseError(response: Response) {
  try {
    const value = (await response.json()) as { error?: unknown }
    if (typeof value.error === "string" && value.error.trim()) return value.error
  } catch {
    // A non-JSON response should still result in a useful, stable error.
  }
  return "Quiz could not be saved."
}

function assessmentLabel(assessment: InitialQuizAssessment) {
  if (assessment === "MISSED") return "Missed"
  if (assessment === "PARTIAL") return "Partial"
  return "Meets"
}

const ASSESSMENTS: readonly InitialQuizAssessment[] = [
  "MISSED",
  "PARTIAL",
  "MEETS",
]

export function InitialQuiz({ goalSkillId, packVersionId, questions, initialDraft }: InitialQuizProps) {
  const quizId = useId()
  const quizQuestions = useMemo(() => [...questions], [questions])
  const [questionPosition, setQuestionPosition] = useState(initialDraft?.state.questionPosition ?? 0)
  const [phase, setPhase] = useState<QuizPhase>(initialDraft?.state.phase ?? "answering")
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(initialDraft?.state.selectedChoiceIndex ?? null)
  const [shortResponse, setShortResponse] = useState(initialDraft?.state.shortResponse ?? "")
  const [shortAssessment, setShortAssessment] =
    useState<InitialQuizAssessment | null>(initialDraft?.state.shortAssessment ?? null)
  const [currentAnswer, setCurrentAnswer] = useState<InitialQuizAnswerInput | null>(() =>
    initialDraft?.state.phase === "feedback" && initialDraft.state.selectedChoiceIndex !== null
      ? { questionIndex: questions[initialDraft.state.questionPosition].questionIndex, response: { selectedChoiceIndex: initialDraft.state.selectedChoiceIndex } }
      : null)
  const [completedAnswers, setCompletedAnswers] = useState<InitialQuizAnswerInput[]>(initialDraft?.state.completedAnswers ?? [])
  const [completedAt, setCompletedAt] = useState<string | null>(initialDraft?.state.completedAt ?? null)
  const [submissionState, setSubmissionState] = useState<SubmissionState>(initialDraft?.state.completedAt ? "error" : "idle")
  const [saveError, setSaveError] = useState<string | undefined>(initialDraft?.state.completedAt ? "Your answers are saved. Finish saving your quiz below." : undefined)
  const [nextGapId, setNextGapId] = useState<string>()
  const startedAtRef = useRef<string | undefined>(initialDraft?.startedAt)
  const attemptPayloadRef = useRef<InitialQuizAttemptPayload | null>(initialDraft?.state.completedAt ?
    buildInitialQuizAttemptPayload({ attemptId: initialDraft.attemptId, goalSkillId, packVersionId,
      startedAt: initialDraft.startedAt, completedAt: initialDraft.state.completedAt,
      questions, answers: initialDraft.state.completedAnswers }) : null)
  const requestInFlightRef = useRef(false)
  const completionStartedRef = useRef(false)
  const questionHeadingRef = useRef<HTMLHeadingElement>(null)
  const feedbackHeadingRef = useRef<HTMLDivElement>(null)
  const completionHeadingRef = useRef<HTMLHeadingElement>(null)
  const sourceDetailsRef = useRef<HTMLDetailsElement>(null)
  const sourceSummaryRef = useRef<HTMLElement>(null)
  const draftState: QuizDraftState = { questionPosition, phase, selectedChoiceIndex, shortResponse,
    shortAssessment, completedAnswers, completedAt }
  const draft = useQuizDraft(packVersionId, initialDraft, draftState, submissionState !== "complete")
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(`/skills/${goalSkillId}/quiz?start=1`)}`
  const draftStatus = initialDraft ? (
    <div className="text-sm">
      <p role="status" className={draft.error ? "text-destructive" : "text-muted-foreground"}>
        {draft.error ?? (draft.dirty ? "Saving…" : "Saved")}
      </p>
      {draft.error ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {draft.authRequired ? <a href={loginHref} target="_blank" rel="noopener noreferrer" className="underline">Sign in in a new tab, then retry</a> : null}
          {draft.conflict ? <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload saved quiz</Button> :
            <Button type="button" variant="outline" onClick={() => void draft.save(draftState).catch(() => {})}>Retry draft save</Button>}
        </div>
      ) : null}
    </div>
  ) : null

  const currentQuizQuestion = quizQuestions[questionPosition]
  const currentQuestion = currentQuizQuestion?.question
  const packQuestionIndex = currentQuizQuestion?.questionIndex ?? -1

  useEffect(() => {
    if (phase === "feedback") feedbackHeadingRef.current?.focus()
  }, [phase])

  useEffect(() => {
    if (questionPosition > 0 && phase === "answering") {
      questionHeadingRef.current?.focus()
    }
  }, [phase, questionPosition])

  useEffect(() => {
    if (submissionState === "complete") completionHeadingRef.current?.focus()
  }, [submissionState])

  if (!currentQuestion || quizQuestions.length === 0) {
    return (
      <Alert role="alert" variant="destructive">
        This quiz has no available practice questions.
      </Alert>
    )
  }

  const markStarted = () => {
    startedAtRef.current ??= new Date().toISOString()
  }

  const postAttempt = async (payload: InitialQuizAttemptPayload) => {
    if (requestInFlightRef.current || submissionState === "complete") return

    requestInFlightRef.current = true
    setSubmissionState("submitting")
    setSaveError(undefined)

    try {
      await draft.save({ ...draftState, completedAnswers: completedAnswers.length === questions.length ? completedAnswers :
        payload.answers.map((answer) => "selectedChoiceIndex" in answer.response
          ? { questionIndex: answer.questionIndex, response: answer.response }
          : { questionIndex: answer.questionIndex, response: answer.response, assessment: answer.result.assessment }), completedAt: payload.completedAt })
      const response = await fetch(initialQuizAttemptsEndpoint(packVersionId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      })

      if (!response.ok) throw new Error(await responseError(response))
      const result = (await response.json()) as { nextGapId?: unknown }
      setNextGapId(
        typeof result.nextGapId === "string" && result.nextGapId.trim()
          ? result.nextGapId
          : undefined,
      )
      setSubmissionState("complete")
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Quiz could not be saved.")
      setSubmissionState("error")
    } finally {
      requestInFlightRef.current = false
    }
  }

  const completeQuiz = (answers: InitialQuizAnswerInput[]) => {
    if (completionStartedRef.current) return
    completionStartedRef.current = true

    const completedAt = new Date().toISOString()
    setCompletedAt(completedAt)
    const payload = buildInitialQuizAttemptPayload({
      attemptId: initialDraft?.attemptId ?? crypto.randomUUID(),
      goalSkillId,
      packVersionId,
      startedAt: startedAtRef.current ?? completedAt,
      completedAt,
      questions: quizQuestions,
      answers,
    })
    attemptPayloadRef.current = payload
    void postAttempt(payload)
  }

  const advance = (answer: InitialQuizAnswerInput) => {
    const answers = [...completedAnswers, answer]
    setCompletedAnswers(answers)

    if (questionPosition === quizQuestions.length - 1) {
      completeQuiz(answers)
      return
    }

    setQuestionPosition((position) => position + 1)
    setPhase("answering")
    setSelectedChoiceIndex(null)
    setShortResponse("")
    setShortAssessment(null)
    setCurrentAnswer(null)
  }

  const checkMultipleChoice = () => {
    if (
      currentQuestion.type !== "MULTIPLE_CHOICE" ||
      selectedChoiceIndex === null ||
      phase !== "answering"
    ) {
      return
    }

    markStarted()
    setCurrentAnswer({
      questionIndex: packQuestionIndex,
      response: { selectedChoiceIndex },
    })
    setPhase("feedback")
  }

  const compareShortResponse = () => {
    if (
      currentQuestion.type !== "SHORT_RESPONSE" ||
      !shortResponse.trim() ||
      phase !== "answering"
    ) {
      return
    }

    markStarted()
    setPhase("feedback")
  }

  const reviewSource = () => {
    if (!sourceDetailsRef.current) return
    sourceDetailsRef.current.open = true
    sourceSummaryRef.current?.focus()
  }

  if (submissionState !== "idle") {
    const metCount = completedAnswers.reduce((count, answer) => {
      if (isMultipleChoiceAnswer(answer)) {
        const question = quizQuestions.find(
          (candidate) => candidate.questionIndex === answer.questionIndex,
        )?.question
        return count +
          (question?.correctChoiceIndex === answer.response.selectedChoiceIndex ? 1 : 0)
      }
      return count + (answer.assessment === "MEETS" ? 1 : 0)
    }, 0)
    const reviewQuestions = completedAnswers.flatMap((answer) => {
      const quizQuestion = quizQuestions.find(
        (candidate) => candidate.questionIndex === answer.questionIndex,
      )
      if (!quizQuestion) return []

      const needsReview = isMultipleChoiceAnswer(answer)
        ? quizQuestion.question.correctChoiceIndex !== answer.response.selectedChoiceIndex
        : answer.assessment !== "MEETS"
      return needsReview ? [quizQuestion.question] : []
    })

    if (submissionState === "complete") {
      return (
        <section className="mx-auto max-w-2xl space-y-4" aria-labelledby={`${quizId}-complete`}>
          <p className="text-sm text-muted-foreground">Initial quiz</p>
          <h2
            id={`${quizId}-complete`}
            ref={completionHeadingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight focus:outline-none"
          >
            Quiz saved
          </h2>
          <p className="text-muted-foreground">
            {reviewQuestions.length === 0
              ? `All ${quizQuestions.length} met. Recall is scheduled.`
              : `${metCount} of ${quizQuestions.length} met. Strengthen one missed idea before recall.`}
          </p>
          {reviewQuestions.length > 0 ? (
            <details className="rounded-lg border border-border bg-card px-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
                What to review ({reviewQuestions.length})
              </summary>
              <ul className="space-y-3 border-t border-border py-3 text-sm">
                {reviewQuestions.map((question) => (
                  <li key={`${question.questionFamilyId}-${question.prompt}`}>
                    <p className="font-medium">{question.prompt}</p>
                    <p className="mt-1 break-words text-muted-foreground">
                      {question.citation.locator}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            {nextGapId ? (
              <ButtonLink
                href={`/skills/${goalSkillId}/strengthen/${encodeURIComponent(nextGapId)}`}
                className="w-full sm:w-auto"
              >
                Strengthen this
              </ButtonLink>
            ) : null}
            <ButtonLink
              href="/today"
              variant={nextGapId ? "ghost" : "default"}
              className="w-full sm:w-auto"
            >
              Done
            </ButtonLink>
          </div>
        </section>
      )
    }

    return (
      <section className="mx-auto max-w-2xl space-y-4" aria-label="Saving quiz">
        {draftStatus}
        {submissionState === "submitting" ? (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            Saving quiz…
          </p>
        ) : (
          <>
            <Alert role="alert" variant="destructive">
              {saveError ?? "Quiz could not be saved."}
            </Alert>
            <Button
              type="button"
              onClick={() => {
                if (attemptPayloadRef.current) void postAttempt(attemptPayloadRef.current)
              }}
            >
              Retry save
            </Button>
            <div><ButtonLink href="/today" variant="ghost">Go to Today</ButtonLink></div>
          </>
        )}
      </section>
    )
  }

  const multipleChoiceIsCorrect =
    currentQuestion.type === "MULTIPLE_CHOICE" &&
    selectedChoiceIndex === currentQuestion.correctChoiceIndex
  const missed =
    (currentQuestion.type === "MULTIPLE_CHOICE" &&
      phase === "feedback" &&
      !multipleChoiceIsCorrect) ||
    (currentQuestion.type === "SHORT_RESPONSE" && shortAssessment === "MISSED")

  return (
    <section className="mx-auto min-w-0 max-w-2xl space-y-5" aria-labelledby={`${quizId}-question`}>
      {draftStatus}
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>Initial quiz</span>
          <span>
            {questionPosition + 1} / {questions.length}
          </span>
        </div>
        <progress
          className="h-1.5 w-full accent-primary"
          value={questionPosition + 1}
          max={questions.length}
          aria-label={`Question ${questionPosition + 1} of ${questions.length}`}
        />
        <h2
          id={`${quizId}-question`}
          ref={questionHeadingRef}
          tabIndex={-1}
          className="break-words text-xl font-semibold leading-8 tracking-tight focus:outline-none sm:text-2xl"
        >
          {currentQuestion.prompt}
        </h2>
      </header>

      {currentQuestion.type === "MULTIPLE_CHOICE" ? (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (phase === "answering") checkMultipleChoice()
            else if (currentAnswer) advance(currentAnswer)
          }}
        >
          <fieldset disabled={phase === "feedback"}>
            <legend className="sr-only">Choose one answer</legend>
            <div className="space-y-2">
              {currentQuestion.choices.map((choice, choiceIndex) => {
                const choiceId = `${quizId}-choice-${questionPosition}-${choiceIndex}`
                const isSelected = selectedChoiceIndex === choiceIndex
                const isCorrectChoice = currentQuestion.correctChoiceIndex === choiceIndex
                const feedbackLabel =
                  phase !== "feedback"
                    ? undefined
                    : isCorrectChoice
                      ? "Correct"
                      : isSelected
                        ? "Your answer"
                        : undefined
                const feedbackStyle =
                  phase === "feedback" && isCorrectChoice
                    ? "border-success bg-sage-light"
                    : phase === "feedback" && isSelected
                      ? "border-destructive bg-terracotta-light"
                      : "border-border bg-card"

                return (
                  <label
                    key={choiceId}
                    htmlFor={choiceId}
                    className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-6 ${feedbackStyle}`}
                  >
                    <input
                      id={choiceId}
                      type="radio"
                      name={`${quizId}-answer`}
                      value={choiceIndex}
                      checked={isSelected}
                      onChange={() => {
                        markStarted()
                        setSelectedChoiceIndex(choiceIndex)
                      }}
                      className="mt-1 size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1 break-words">{choice}</span>
                    {feedbackLabel ? (
                      <span className="ml-auto shrink-0 text-xs font-semibold">
                        {feedbackLabel}
                      </span>
                    ) : null}
                  </label>
                )
              })}
            </div>
          </fieldset>

          {phase === "answering" ? (
            <Button type="submit" disabled={selectedChoiceIndex === null} className="w-full sm:w-auto">
              Check answer
            </Button>
          ) : (
            <div className="space-y-5">
              <div
                ref={feedbackHeadingRef}
                tabIndex={-1}
                className="space-y-2 rounded-lg border border-border bg-muted p-4 focus:outline-none"
                aria-live="polite"
              >
                <h3 className="font-semibold">
                  {multipleChoiceIsCorrect ? "Correct" : "Missed"}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  {currentQuestion.explanation}
                </p>
              </div>

              <SourceDisclosure
                key={packQuestionIndex}
                detailsRef={sourceDetailsRef}
                summaryRef={sourceSummaryRef}
                citation={currentQuestion.citation}
              />

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                {missed ? (
                  <Button type="button" variant="outline" onClick={reviewSource} className="w-full sm:w-auto">
                    Review source
                  </Button>
                ) : null}
                <Button type="submit" className="w-full sm:w-auto">
                  {questionPosition === questions.length - 1 ? "Finish quiz" : "Next"}
                </Button>
              </div>
            </div>
          )}
        </form>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (phase === "answering") {
              compareShortResponse()
              return
            }
            if (!shortAssessment) return
            advance({
              questionIndex: packQuestionIndex,
              response: { text: shortResponse },
              assessment: shortAssessment,
            })
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor={`${quizId}-short-answer`} className="text-sm font-medium">
              Your answer
            </label>
            <Textarea
              id={`${quizId}-short-answer`}
              value={shortResponse}
              onChange={(event) => {
                markStarted()
                setShortResponse(event.target.value)
              }}
              readOnly={phase === "feedback"}
              maxLength={4_000}
              autoFocus
            />
          </div>

          {phase === "answering" ? (
            <Button type="submit" disabled={!shortResponse.trim()} className="w-full sm:w-auto">
              Compare answer
            </Button>
          ) : (
            <div className="space-y-5">
              <div
                ref={feedbackHeadingRef}
                tabIndex={-1}
                className="space-y-3 rounded-lg border border-border bg-muted p-4 focus:outline-none"
                aria-live="polite"
              >
                <h3 className="font-semibold">Reference / rubric</h3>
                <p className="whitespace-pre-wrap break-words leading-7">
                  {currentQuestion.referenceAnswer}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {currentQuestion.explanation}
                </p>
              </div>

              <SourceDisclosure
                key={packQuestionIndex}
                detailsRef={sourceDetailsRef}
                summaryRef={sourceSummaryRef}
                citation={currentQuestion.citation}
              />

              <fieldset>
                <legend className="mb-2 text-sm font-medium">How did your answer compare?</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {ASSESSMENTS.map((assessment) => {
                    const assessmentId = `${quizId}-${assessment.toLowerCase()}`
                    return (
                      <label
                        key={assessment}
                        htmlFor={assessmentId}
                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium"
                      >
                        <input
                          id={assessmentId}
                          type="radio"
                          name={`${quizId}-assessment`}
                          checked={shortAssessment === assessment}
                          onChange={() => setShortAssessment(assessment)}
                          className="size-4 accent-primary"
                        />
                        {assessmentLabel(assessment)}
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                {missed ? (
                  <Button type="button" variant="outline" onClick={reviewSource} className="w-full sm:w-auto">
                    Review source
                  </Button>
                ) : null}
                <Button type="submit" disabled={!shortAssessment} className="w-full sm:w-auto">
                  {questionPosition === questions.length - 1 ? "Finish quiz" : "Next"}
                </Button>
              </div>
            </div>
          )}
        </form>
      )}
    </section>
  )
}

type SourceDisclosureProps = {
  citation: LearningPack["questions"][number]["citation"]
  detailsRef: RefObject<HTMLDetailsElement | null>
  summaryRef: RefObject<HTMLElement | null>
}

function SourceDisclosure({
  citation,
  detailsRef,
  summaryRef,
}: SourceDisclosureProps) {
  return (
    <details ref={detailsRef} className="rounded-lg border border-border bg-card px-3">
      <summary
        ref={summaryRef}
        className="flex min-h-11 cursor-pointer items-center text-sm font-medium"
      >
        Source
      </summary>
      <div className="space-y-2 border-t border-border py-3 text-sm leading-6">
        <p className="break-words text-muted-foreground">
          {citation.sourceId} · {citation.locator}
        </p>
        <blockquote className="break-words border-l-2 border-primary pl-3">
          “{citation.excerpt}”
        </blockquote>
      </div>
    </details>
  )
}
