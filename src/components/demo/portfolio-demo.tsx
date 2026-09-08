"use client"

import { useRef, useState } from "react"
import { RotateCcwIcon } from "lucide-react"
import { SkillTree } from "@/components/learning/skill-tree"
import { Badge } from "@/components/ui/badge"
import { BrandMark } from "@/components/ui/brand-mark"
import { Button } from "@/components/ui/button"
import { PaperCard, PaperCardContent } from "@/components/ui/paper-card"
import { Textarea } from "@/components/ui/textarea"
import type { TodayLeaf } from "@/lib/learning/today-query"
import { cn } from "@/lib/utils"

type DemoView = "today" | "tree" | "practice" | "complete"
type DemoRating = "AGAIN" | "HARD" | "GOOD" | "EASY"
type DemoResult = {
  confidence: "HIGH"
  next: string
  rating: DemoRating
  reason: string
  stage: "LEARNING" | "DEMONSTRATED" | "WELL_LEARNED"
}

const RATINGS: Array<{ value: DemoRating; label: string; anchor: string }> = [
  { value: "AGAIN", label: "Missed", anchor: "Try again" },
  { value: "HARD", label: "Correct · hard", anchor: "High effort" },
  { value: "GOOD", label: "Correct", anchor: "Normal effort" },
  { value: "EASY", label: "Correct · easy", anchor: "Low effort" },
]

const RESULTS: Record<DemoRating, DemoResult> = {
  AGAIN: {
    confidence: "HIGH",
    next: "In 10 minutes",
    rating: "AGAIN",
    reason: "Latest recall missed · refresh scheduled",
    stage: "LEARNING",
  },
  HARD: {
    confidence: "HIGH",
    next: "In 7 days",
    rating: "HARD",
    reason: "Recall retained · more evidence needed",
    stage: "DEMONSTRATED",
  },
  GOOD: {
    confidence: "HIGH",
    next: "In 30 days",
    rating: "GOOD",
    reason: "Two spaced new-angle checks met",
    stage: "WELL_LEARNED",
  },
  EASY: {
    confidence: "HIGH",
    next: "In 45 days",
    rating: "EASY",
    reason: "Two spaced new-angle checks met",
    stage: "WELL_LEARNED",
  },
}

const BASE_LEAF: TodayLeaf = {
  goalId: "portfolio-demo-goal",
  goalTitle: "Build accessible React interfaces",
  goalOutcome: "Build interfaces that work for keyboard and assistive technology users.",
  goalSkillId: "portfolio-demo-skill",
  branchTitle: "Interaction semantics",
  title: "Accessible buttons",
  outcome: "Explain and implement an accessible button.",
  successCriterion: "Name the accessible-name sources and choose the right native element.",
  stage: "DEMONSTRATED",
  confidence: "HIGH",
  dueState: "DUE",
  dueAt: new Date(0),
  evidenceCount: 9,
  successCount: 8,
  reason: "One new-angle check remains",
}

function displayRating(rating: DemoRating) {
  return RATINGS.find((option) => option.value === rating)?.label ?? rating
}

function displayStage(stage: DemoResult["stage"]) {
  return stage.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
}

function DemoHeader({
  activeView,
  onNavigate,
  onReset,
}: {
  activeView: "today" | "tree"
  onNavigate: (view: "today" | "tree") => void
  onReset: () => void
}) {
  return (
    <header className="border-b border-border bg-background/95">
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
        <BrandMark compact className="mr-auto shrink-0" />
        <nav aria-label="Demo navigation" className="flex items-center gap-1">
          {(["today", "tree"] as const).map((view) => (
            <button
              key={view}
              type="button"
              aria-current={activeView === view ? "page" : undefined}
              className={cn(
                "min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                activeView === view
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onNavigate(view)}
            >
              {view === "today" ? "Today" : "Tree"}
            </button>
          ))}
        </nav>
        <Button type="button" variant="ghost" size="icon" onClick={onReset}>
          <RotateCcwIcon aria-hidden="true" className="size-4" />
          <span className="sr-only">Reset demo</span>
        </Button>
      </div>
    </header>
  )
}

function ReviewCard({ onStart }: { onStart: () => void }) {
  return (
    <PaperCard>
      <PaperCardContent className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:py-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">New angle due</p>
          <h2 className="mt-1 text-xl font-semibold">Accessible buttons</h2>
        </div>
        <Button type="button" className="w-full sm:w-auto" onClick={onStart}>
          Start
        </Button>
      </PaperCardContent>
    </PaperCard>
  )
}

function Practice({ onComplete }: { onComplete: (rating: DemoRating) => void }) {
  const [answer, setAnswer] = useState("")
  const [revealed, setRevealed] = useState(false)
  const referenceRef = useRef<HTMLDivElement>(null)

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Accessible buttons</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Recall</h1>
        <Badge variant="muted" className="mt-3">New angle</Badge>
      </header>

      <p className="border-y border-border py-5 text-xl font-medium leading-8">
        What gives a button its accessible name?
      </p>

      <div>
        <label htmlFor="demo-answer" className="mb-1.5 block text-sm font-medium">
          Your answer
        </label>
        <Textarea
          id="demo-answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          readOnly={revealed}
          autoFocus
        />
      </div>

      {!revealed ? (
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          disabled={!answer.trim()}
          onClick={() => {
            setRevealed(true)
            requestAnimationFrame(() => referenceRef.current?.focus())
          }}
        >
          Reveal answer
        </Button>
      ) : (
        <div className="space-y-6" aria-live="polite">
          <div
            ref={referenceRef}
            tabIndex={-1}
            aria-label="Reference answer"
            className="rounded-lg border border-border bg-muted/40 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reference</p>
            <p className="mt-2 whitespace-pre-wrap leading-7">
              Visible text, or aria-label / aria-labelledby when visible text is unavailable.
            </p>
          </div>
          <fieldset>
            <legend className="mb-3 text-sm font-medium">How did you do?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((rating) => (
                <Button
                  key={rating.value}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-14 flex-col gap-0.5"
                  onClick={() => onComplete(rating.value)}
                >
                  <span>{rating.label}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{rating.anchor}</span>
                </Button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  )
}

function Completion({ result, onDone }: { result: DemoResult; onDone: () => void }) {
  const learned = result.stage === "WELL_LEARNED"

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4">
      <div role="status" aria-live="polite" className="space-y-4">
        <Badge variant={learned ? "learned" : result.stage === "DEMONSTRATED" ? "demonstrated" : "learning"}>
          {displayStage(result.stage)}
        </Badge>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Review saved</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Accessible buttons</h1>
        </div>
      </div>
      <div className="border-y border-border py-5">
        <p className="font-medium">{displayRating(result.rating)} · self-rated</p>
        <p className="mt-1 text-sm text-muted-foreground">Next {result.next.toLowerCase()}</p>
        <details className="mt-4 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Why this changed</summary>
          <p className="mt-2 leading-6">{result.reason}</p>
        </details>
      </div>
      <Button type="button" className="w-full sm:w-auto" onClick={onDone}>
        Done
      </Button>
    </div>
  )
}

export function PortfolioDemo() {
  const [view, setView] = useState<DemoView>("today")
  const [result, setResult] = useState<DemoResult>()

  const leaf: TodayLeaf = result
    ? {
      ...BASE_LEAF,
      stage: result.stage,
      confidence: result.confidence,
      dueState: result.rating === "AGAIN" ? "DUE" : "CURRENT",
      evidenceCount: BASE_LEAF.evidenceCount + 1,
      successCount: BASE_LEAF.successCount + (result.rating === "AGAIN" ? 0 : 1),
      reason: result.reason,
    }
    : BASE_LEAF

  const reset = () => {
    setResult(undefined)
    setView("today")
  }
  const activeView = view === "tree" ? "tree" : "today"

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <a
        href="#demo-content"
        className="fixed left-4 top-3 z-[60] -translate-y-24 bg-card px-4 py-2 font-bold text-foreground focus:translate-y-0"
      >
        Skip to content
      </a>
      <DemoHeader activeView={activeView} onNavigate={setView} onReset={reset} />
      <main id="demo-content" className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {view === "practice" ? (
          <Practice
            onComplete={(rating) => {
              setResult(RESULTS[rating])
              setView("complete")
            }}
          />
        ) : view === "complete" && result ? (
          <Completion result={result} onDone={() => setView("today")} />
        ) : view === "tree" ? (
          <div className="space-y-4">
            <SkillTree leaf={leaf} headingLevel="h1" />
            <p className="text-center text-xs text-muted-foreground">Synthetic data · resets on refresh</p>
          </div>
        ) : (
          <div className="mx-auto max-w-xl space-y-6">
            <header>
              <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
            </header>
            {result ? (
              <PaperCard>
                <PaperCardContent className="py-5 sm:py-6">
                  <p className="text-sm font-medium text-muted-foreground">Next {result.next.toLowerCase()}</p>
                  <h2 className="mt-1 text-xl font-semibold">Accessible buttons</h2>
                </PaperCardContent>
              </PaperCard>
            ) : (
              <ReviewCard onStart={() => setView("practice")} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
