import { redirect } from "next/navigation"
import { AppShell } from "@/components/app/app-shell"
import { SkillTree } from "@/components/learning/skill-tree"
import { StartReviewForm } from "@/components/learning/start-review-form"
import { ButtonLink } from "@/components/ui/button-link"
import { PaperCard, PaperCardContent } from "@/components/ui/paper-card"
import { auth } from "@/lib/auth"
import { getTodayData, type TodayLeaf } from "@/lib/learning/today-query"
import { prisma } from "@/lib/prisma"

export const metadata = { title: "Today" }
export const dynamic = "force-dynamic"

function formatDueDate(date: Date, timezone = "UTC") {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function ReviewHome({
  leaf,
  kind,
  sessionId,
  timezone,
  selected = false,
}: {
  leaf: TodayLeaf
  kind: "RESUME" | "REVIEW" | "CURRENT"
  sessionId?: string
  timezone: string
  selected?: boolean
}) {
  const timing =
    kind === "CURRENT"
      ? `Next ${formatDueDate(leaf.dueAt, timezone)}`
      : leaf.stage === "WELL_LEARNED"
        ? "Refresh due"
        : leaf.dueState === "OVERDUE"
          ? "Overdue"
          : "Due now"

  return (
    <div className="space-y-8">
      <header>
        {selected && kind !== "CURRENT" ? (
          <ButtonLink href={`/skills/${leaf.goalSkillId}`} variant="ghost" size="sm" className="mb-3 -ml-2">Back to skill</ButtonLink>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{selected ? "Recall" : "Today"}</h1>
      </header>

      <PaperCard tone={kind === "CURRENT" ? "sage" : "note"}>
        <PaperCardContent className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{timing}</p>
            <h2 className="mt-1 text-xl font-semibold">{leaf.title}</h2>
          </div>
          {kind === "RESUME" && sessionId ? (
            <ButtonLink href={`/practice/${sessionId}`} size="lg" className="w-full sm:w-auto">
              Resume
            </ButtonLink>
          ) : kind === "REVIEW" ? (
            <StartReviewForm goalSkillId={leaf.goalSkillId} />
          ) : (
            <ButtonLink href={selected ? `/skills/${leaf.goalSkillId}` : "/today/new"} size="lg" className="w-full sm:w-auto">
              {selected ? "Back to skill" : "Learn something"}
            </ButtonLink>
          )}
        </PaperCardContent>
      </PaperCard>

      <details className="group border-t border-border pt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-muted-foreground marker:content-none">
          View in tree
          <span aria-hidden="true" className="transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="pt-4">
          <SkillTree leaf={leaf} compact />
        </div>
      </details>
    </div>
  )
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string | string[] }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login?returnTo=/today")

  const requestedSkill = (await searchParams).skill
  const preferredGoalSkillId =
    typeof requestedSkill === "string" ? requestedSkill : undefined
  const now = new Date()

  const [data, user] = await Promise.all([
    getTodayData(session.user.id, now, preferredGoalSkillId),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    }),
  ])

  if (data.kind === "SESSION_CONFLICT") {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl space-y-5 py-10 sm:py-20">
          <p className="text-sm text-muted-foreground">{data.requestedTitle}</p>
          <h1 className="text-3xl font-semibold tracking-tight">You have a recall in progress</h1>
          <p className="text-muted-foreground">Finish your {data.activeTitle} recall before starting {data.requestedTitle}. Your answers are saved.</p>
          <ButtonLink href={`/practice/${data.sessionId}`}>Resume {data.activeTitle}</ButtonLink>
          <div><ButtonLink href="/skills" variant="ghost">Back to skills</ButtonLink></div>
        </div>
      </AppShell>
    )
  }

  if (data.kind === "EMPTY") {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl py-10 sm:py-20">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What will you learn?</h1>
          <ButtonLink href={data.href} size="lg" className="mt-8 w-full sm:w-auto">
            Get started
          </ButtonLink>
        </div>
      </AppShell>
    )
  }

  if (data.kind === "SETUP_SOURCE") {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl py-10 sm:py-20">
          <p className="text-sm text-muted-foreground">{data.skillTitle}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Add sources</h1>
          <ButtonLink
            href={data.href}
            size="lg"
            className="mt-7 w-full sm:w-auto"
          >
            Continue
          </ButtonLink>
        </div>
      </AppShell>
    )
  }

  if (data.kind === "STRENGTHEN") {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl py-10 sm:py-20">
          <p className="text-sm font-medium text-success">{data.skillTitle}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {data.gapLabel}
          </h1>
          <ButtonLink href={data.href} size="lg" className="mt-7 w-full sm:w-auto">
            Strengthen
          </ButtonLink>
          {data.recall ? (
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">Recall also due</p>
              <ButtonLink href={`/today?skill=${encodeURIComponent(data.recall.goalSkillId)}`} variant="outline" className="mt-2 h-auto min-h-11 max-w-full whitespace-normal text-left">
                Recall · {data.recall.title}
              </ButtonLink>
            </div>
          ) : null}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <ReviewHome
        leaf={data.leaf}
        kind={data.kind}
        sessionId={data.kind === "RESUME" ? data.sessionId : undefined}
        timezone={user?.timezone ?? "UTC"}
        selected={Boolean(preferredGoalSkillId)}
      />
    </AppShell>
  )
}
