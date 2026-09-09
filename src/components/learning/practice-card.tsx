"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import { PaperCard, PaperCardContent } from "@/components/ui/paper-card"
import { Textarea } from "@/components/ui/textarea"
import { AnswerAssessmentPicker, type AnswerAssessment } from "@/components/learning/answer-assessment"
import { MasteryMilestonePanel } from "@/components/learning/mastery-milestone"
import type { MasteryMilestone } from "@/lib/learning/types"

type Phase = "PROMPT" | "DRAFTING" | "REVEALED" | "SAVING" | "COMPLETED"
type Rating = "AGAIN" | "HARD" | "GOOD" | "EASY"
type SaveStatus = "idle" | "saving" | "saved"

const RATINGS: Array<{ value: Rating; label: string; anchor: string }> = [
  { value: "AGAIN", label: "Missed", anchor: "Try again" },
  { value: "HARD", label: "Hard", anchor: "High effort" },
  { value: "GOOD", label: "Good", anchor: "Normal effort" },
  { value: "EASY", label: "Easy", anchor: "Low effort" },
]

function displayRating(rating: Rating) {
  return RATINGS.find((option) => option.value === rating)?.label ?? displayStage(rating)
}

function displayOutcome(summary: PracticeSummary) {
  if (summary.skipped) return "Not answered"
  if (summary.assessment && summary.assessment !== "MEETS") return displayStage(summary.assessment)
  if (summary.objectiveCorrect && summary.rating === "AGAIN") return "Guessed"
  return `${summary.assessment === "MEETS" ? "Meets · " : ""}${summary.rating ? displayRating(summary.rating) : "Review"}`
}

export type PracticeSummary = {
  milestone?: MasteryMilestone
  skillTitle: string
  goalSkillId?: string
  stageBefore: string
  stageAfter: string
  confidence: string
  rating?: Rating
  assessment?: AnswerAssessment
  skipped?: boolean
  evidenceWeight?: number
  timezone?: string
  nextReviewAt: string
  reason: string
  sessionComplete?: boolean
  completedCount?: number
  totalCount?: number
  objectiveCorrect?: boolean
  isTransfer?: boolean
  gapId?: string
  resolvedGapId?: string
}

type PracticeCardProps = {
  sessionId: string
  itemId: string
  skillTitle: string
  prompt: string
  initialAnswer: string
  initialPhase: Phase
  initialVersion: number
  initialReferenceAnswer?: string
  initialExplanation?: string | null
  initialSummary?: PracticeSummary
  responseType?: "MULTIPLE_CHOICE" | "SHORT_RESPONSE"
  choices?: string[]
  isTransfer?: boolean
  questionNumber?: number
  totalQuestions?: number
  initialObjectiveCorrect?: boolean
}

type CheckpointResponse = {
  error?: string
  checkpoint?: {
    phase: Phase
    draftAnswer?: string
    lockedAnswer?: string | null
    version: number
    revealedAt?: string | null
  }
  referenceAnswer?: string
  explanation?: string | null
  objectiveCorrect?: boolean
  isTransfer?: boolean
}

async function parseResponseJson<T extends object>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

function displayStage(stage: string) {
  return stage.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
}

function stageVariant(stage: string) {
  if (stage === "WELL_LEARNED") return "learned" as const
  if (stage === "DEMONSTRATED") return "demonstrated" as const
  if (stage === "LEARNING") return "learning" as const
  return "muted" as const
}

function Summary({
  summary,
  sessionId,
}: {
  summary: PracticeSummary
  sessionId: string
}) {
  const router = useRouter()
  const changed = summary.stageBefore !== summary.stageAfter
  const evidenceLabel =
    summary.skipped ? "no learning credit" : summary.evidenceWeight === 0.5
      ? "first review"
      : summary.evidenceWeight === 1
        ? "review on a new day"
        : summary.evidenceWeight === 0
          ? "same-day repeat"
          : undefined

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4" role="status" aria-live="polite">
      <div className="space-y-3">
        <Badge variant={stageVariant(summary.stageAfter)}>
          {displayStage(summary.stageAfter)}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{summary.skillTitle}</h1>
        <p className="text-muted-foreground">{summary.stageAfter === "WELL_LEARNED" && changed ? "Milestone reached." : changed ? summary.reason : "Review saved."}</p>
      </div>

      <dl className="grid gap-5 border-y border-border py-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Progress</dt>
          <dd className="mt-1 font-medium">
            {displayStage(summary.stageBefore)} → {displayStage(summary.stageAfter)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Next review</dt>
          <dd className="mt-1 font-medium">
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: summary.timezone ?? "UTC",
            }).format(new Date(summary.nextReviewAt))}
          </dd>
        </div>
      </dl>

      <MasteryMilestonePanel milestone={summary.milestone} stage={summary.stageAfter} achieved={changed && summary.stageAfter === "WELL_LEARNED"} snapshot />
      {summary.rating ? (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-medium">Review details</summary>
          <p className="pb-2 text-muted-foreground">
            {displayOutcome(summary)}
            {!summary.skipped ? ` · ${summary.objectiveCorrect === undefined ? "self-rated" : "checked"}` : ""}
            {summary.isTransfer ? " · new angle" : ""}
            {evidenceLabel ? ` · ${evidenceLabel}` : ""}
          </p>
        </details>
      ) : null}
      {summary.resolvedGapId ? (
        <p className="text-sm font-medium text-success">
          You recovered a previously missed idea with this recall.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        {summary.gapId && summary.goalSkillId ? (
          <ButtonLink
            href={`/skills/${encodeURIComponent(summary.goalSkillId)}/strengthen/${encodeURIComponent(summary.gapId)}`}
            size="lg"
            className="w-full sm:w-auto"
          >
            Strengthen this
          </ButtonLink>
        ) : null}
        {summary.sessionComplete === false ? (
          <Button
            type="button"
            size="lg"
            variant={summary.gapId ? "outline" : "default"}
            className="w-full sm:w-auto"
            onClick={() => router.push(`/practice/${sessionId}?step=${summary.completedCount ?? 1}`)}
          >
            Next question
          </Button>
        ) : (
          <ButtonLink
            href="/today"
            size="lg"
            variant={summary.gapId ? "ghost" : "default"}
            className="w-full sm:w-auto"
          >
            Done
          </ButtonLink>
        )}
      </div>
    </div>
  )
}

export function PracticeCard({
  sessionId,
  itemId,
  skillTitle,
  prompt,
  initialAnswer,
  initialPhase,
  initialVersion,
  initialReferenceAnswer,
  initialExplanation,
  initialSummary,
  responseType = "SHORT_RESPONSE",
  choices = [],
  isTransfer = false,
  questionNumber = 1,
  totalQuestions = 1,
  initialObjectiveCorrect,
}: PracticeCardProps) {
  const [answer, setAnswer] = useState(initialAnswer)
  const [assessment, setAssessment] = useState<AnswerAssessment | null>(null)
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [referenceAnswer, setReferenceAnswer] = useState(initialReferenceAnswer)
  const [explanation, setExplanation] = useState(initialExplanation)
  const [summary, setSummary] = useState(initialSummary)
  const [objectiveCorrect, setObjectiveCorrect] = useState(initialObjectiveCorrect)
  const [error, setError] = useState<string>()
  const [draftSaveFailed, setDraftSaveFailed] = useState(false)
  const [saveRetry, setSaveRetry] = useState(0)
  const [isBusy, setIsBusy] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialAnswer ? "saved" : "idle")
  const versionRef = useRef(initialVersion)
  const lastSavedRef = useRef(initialAnswer)
  const latestAnswerRef = useRef(initialAnswer)
  const saveChainRef = useRef(Promise.resolve())
  const autosaveTimerRef = useRef<number | null>(null)
  const gradeKeyRef = useRef(crypto.randomUUID())
  const referenceRef = useRef<HTMLDivElement>(null)
  const focusReferenceRef = useRef(false)

  useEffect(() => {
    if (phase !== "PROMPT" && phase !== "DRAFTING") return
    if (answer === lastSavedRef.current) return

    autosaveTimerRef.current = window.setTimeout(() => {
      const draft = answer
      saveChainRef.current = saveChainRef.current.then(async () => {
        const save = async (retry: boolean): Promise<void> => {
          const response = await fetch(`/api/practice/items/${itemId}/checkpoint`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answer: draft, expectedVersion: versionRef.current }),
          })
          const payload = await parseResponseJson<CheckpointResponse>(response)

          if (response.status === 409 && payload?.checkpoint && retry) {
            versionRef.current = payload.checkpoint.version
            await save(false)
            return
          }

          if (!response.ok || !payload?.checkpoint) {
            throw new Error(payload?.error ?? "Draft not saved.")
          }

          versionRef.current = payload.checkpoint.version
          lastSavedRef.current = draft
          setDraftSaveFailed(false)
          setError(undefined)
          setSaveStatus(draft === latestAnswerRef.current ? "saved" : "saving")
          setPhase(payload.checkpoint.phase)
        }

        try {
          await save(true)
        } catch (caughtError) {
          setDraftSaveFailed(true)
          setSaveStatus("idle")
          setError(caughtError instanceof Error ? caughtError.message : "Draft not saved.")
        }
      })
    }, 650)

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [answer, itemId, phase, saveRetry])

  useEffect(() => {
    if (phase !== "REVEALED" || !focusReferenceRef.current) return
    focusReferenceRef.current = false
    referenceRef.current?.focus()
  }, [phase])

  if (summary || phase === "COMPLETED") {
    if (summary) return <Summary summary={summary} sessionId={sessionId} />

    return (
      <div className="mx-auto max-w-2xl space-y-5 py-4">
        <Alert role="alert">Review saved. Summary unavailable.</Alert>
        <ButtonLink href="/today">Back to Today</ButtonLink>
      </div>
    )
  }

  const reveal = async (skipped = false) => {
    if ((!skipped && !answer.trim()) || isBusy) return
    setIsBusy(true)
    setError(undefined)

    try {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      await saveChainRef.current
      const response = await fetch(`/api/practice/items/${itemId}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: skipped ? "" : answer, ...(skipped ? { skipped: true } : {}), expectedVersion: versionRef.current }),
      })
      const payload = await parseResponseJson<CheckpointResponse>(response)

      if (!response.ok || !payload?.checkpoint || !payload.referenceAnswer) {
        throw new Error(payload?.error ?? "Answer not revealed.")
      }

      versionRef.current = payload.checkpoint.version
      setAnswer(payload.checkpoint.lockedAnswer ?? answer)
      latestAnswerRef.current = payload.checkpoint.lockedAnswer ?? answer
      setReferenceAnswer(payload.referenceAnswer)
      setExplanation(payload.explanation)
      setObjectiveCorrect(payload.objectiveCorrect)
      setSaveStatus("saved")
      focusReferenceRef.current = true
      setPhase("REVEALED")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Answer not revealed.")
    } finally {
      setIsBusy(false)
    }
  }

  const grade = async (rating: Rating) => {
    if (phase !== "REVEALED" || isBusy) return
    setIsBusy(true)
    setPhase("SAVING")
    setError(undefined)

    try {
      const response = await fetch(`/api/practice/items/${itemId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          ...(assessment && answer !== "" && objectiveCorrect === undefined ? { assessment } : {}),
          idempotencyKey: gradeKeyRef.current,
          expectedVersion: versionRef.current,
        }),
      })
      const payload = await parseResponseJson<{
        error?: string
        summary?: PracticeSummary
      }>(response)

      if (!response.ok || !payload?.summary) {
        throw new Error(payload?.error ?? "Review not saved.")
      }

      setSummary(payload.summary)
      setPhase("COMPLETED")
    } catch (caughtError) {
      setPhase("REVEALED")
      setError(caughtError instanceof Error ? caughtError.message : "Review not saved.")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6" aria-busy={isBusy || undefined}>
      <header>
        <p className="text-sm text-muted-foreground">
          {skillTitle} · {questionNumber} of {totalQuestions}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Recall</h1>
        {isTransfer ? <Badge variant="muted" className="mt-3">New angle</Badge> : null}
      </header>

      {error ? (
        <Alert role="alert" variant="destructive" className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          {draftSaveFailed ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDraftSaveFailed(false)
                setSaveStatus("saving")
                setSaveRetry((current) => current + 1)
              }}
            >
              Retry
            </Button>
          ) : null}
        </Alert>
      ) : null}

      <PaperCard tone="note">
        <PaperCardContent>
          <p className="text-lg font-medium leading-8 sm:text-xl">{prompt}</p>
        </PaperCardContent>
      </PaperCard>

      {responseType === "MULTIPLE_CHOICE" ? (
        <fieldset disabled={isBusy || phase === "REVEALED" || phase === "SAVING"}>
          <legend className="mb-3 text-sm font-medium">Choose one</legend>
          <div className="space-y-2">
            {choices.map((choice, index) => (
              <label
                key={`${index}-${choice}`}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 has-[:checked]:border-foreground has-[:checked]:bg-muted"
              >
                <input
                  type="radio"
                  name="recall-choice"
                  value={index}
                  checked={answer === String(index)}
                  onChange={() => {
                    const value = String(index)
                    setAnswer(value)
                    latestAnswerRef.current = value
                    setDraftSaveFailed(false)
                    setSaveStatus("saving")
                    setError(undefined)
                  }}
                  autoFocus={index === 0 && (phase === "PROMPT" || phase === "DRAFTING")}
                />
                <span>{choice}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : answer !== "" || phase === "PROMPT" || phase === "DRAFTING" ? (
        <div>
          <div className="mb-1.5 flex min-h-5 items-center justify-between gap-3 text-sm">
            <label htmlFor="recall-answer" className="font-medium">
              Your answer
            </label>
            {saveStatus !== "idle" ? (
              <span className="text-xs font-bold text-muted-foreground" role="status" aria-live="polite">
                {saveStatus === "saving" ? "Saving…" : "Saved"}
              </span>
            ) : null}
          </div>
          <Textarea
            id="recall-answer"
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value)
              latestAnswerRef.current = event.target.value
              setDraftSaveFailed(false)
              setSaveStatus("saving")
              setError(undefined)
            }}
            maxLength={10_000}
            readOnly={isBusy || phase === "REVEALED" || phase === "SAVING"}
            autoFocus={phase === "PROMPT" || phase === "DRAFTING"}
          />
        </div>
      ) : null}

      {phase === "PROMPT" || phase === "DRAFTING" ? (
        <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => void reveal()}
          isLoading={isBusy}
          disabled={!answer.trim() || isBusy}
        >
          {responseType === "MULTIPLE_CHOICE" ? "Check answer" : "Compare answer"}
        </Button>
        <Button type="button" variant="ghost" disabled={isBusy} onClick={() => void reveal(true)}>I don’t know</Button>
        </div>
      ) : (
        <div className="space-y-5" aria-live="polite">
          <PaperCard
            ref={referenceRef}
            tone="sage"
            tabIndex={-1}
            aria-label="Reference answer"
            className="focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          >
            <PaperCardContent className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                {answer === "" ? "Not answered" : objectiveCorrect === undefined
                  ? "Reference answer"
                  : objectiveCorrect
                    ? "Correct"
                    : "Missed"}
              </p>
              {answer === "" ? <p className="text-sm text-muted-foreground">No learning credit. Review this explanation, then try again later.</p> : null}
              <p className="whitespace-pre-wrap leading-7">{referenceAnswer}</p>
              {explanation ? <p className="text-sm leading-6 text-muted-foreground">{explanation}</p> : null}
            </PaperCardContent>
          </PaperCard>
          {objectiveCorrect === false || answer === "" ? (
            <Button
              type="button"
              size="lg"
              onClick={() => void grade("AGAIN")}
              disabled={isBusy || phase === "SAVING"}
            >
              Continue
            </Button>
          ) : (
            <div className="space-y-4">
            {objectiveCorrect === undefined ? <AnswerAssessmentPicker value={assessment} onChange={setAssessment} disabled={isBusy || phase === "SAVING"} /> : null}
            {assessment === "MISSED" || assessment === "PARTIAL" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{assessment === "PARTIAL" ? "Some ideas are missing. This stays on the retry path." : "Review the explanation, then try again later."}</p>
                <Button type="button" onClick={() => void grade("AGAIN")} disabled={isBusy || phase === "SAVING"}>Continue</Button>
              </div>
            ) : objectiveCorrect || assessment === "MEETS" ? <fieldset disabled={isBusy || phase === "SAVING"}>
              <legend className="mb-3 text-sm font-medium">
                How much effort did it take?
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {RATINGS.filter((rating) => rating.value !== "AGAIN").map((rating) => (
                  <Button
                    key={rating.value}
                    type="button"
                    variant="outline"
                    className="min-h-14 min-w-0 whitespace-normal px-2"
                    onClick={() => void grade(rating.value)}
                    disabled={isBusy || phase === "SAVING"}
                  >
                    <span>{rating.label}<span className="block text-xs font-normal text-muted-foreground">{rating.anchor}</span></span>
                  </Button>
                ))}
              </div>
              {objectiveCorrect ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => void grade("AGAIN")}
                  disabled={isBusy || phase === "SAVING"}
                >
                  I guessed
                </Button>
              ) : null}
            </fieldset> : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
