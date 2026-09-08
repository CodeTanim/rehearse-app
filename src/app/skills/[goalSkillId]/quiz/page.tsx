import { notFound, redirect } from "next/navigation"

import { AppShell } from "@/components/app/app-shell"
import { InitialQuiz } from "@/components/learning/initial-quiz"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button-link"
import { auth } from "@/lib/auth"
import {
  initialQuizQuestions,
  visibleInitialQuizQuestions,
} from "@/lib/ai/learning-pack-schema"
import { LOCAL_LEARNING_PACK_MODEL } from "@/lib/ai/local-learning-pack"
import { getCurrentLearningPack } from "@/lib/learning/learning-pack-service"
import { getQuizDraft } from "@/lib/learning/initial-quiz-draft-service"

export const metadata = { title: "Initial quiz" }
export const dynamic = "force-dynamic"

export default async function SkillQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ goalSkillId: string }>
  searchParams: Promise<{ start?: string }>
}) {
  const { goalSkillId } = await params
  const query = await searchParams
  const session = await auth()
  if (!session?.user?.id) redirect(`/auth/login?returnTo=${encodeURIComponent(`/skills/${goalSkillId}/quiz${query.start === "1" ? "?start=1" : ""}`)}`)
  const data = await getCurrentLearningPack({
    userId: session.user.id,
    goalSkillId,
  })
  if (!data) notFound()

  if (data.completed) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl space-y-5 py-10 sm:py-20">
          <p className="text-sm text-muted-foreground">Quiz complete</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {data.skillTitle}
          </h1>
          <p className="text-muted-foreground">Your recall is scheduled.</p>
          <ButtonLink href="/today" size="lg">Go to Today</ButtonLink>
        </div>
      </AppShell>
    )
  }

  if (query.start !== "1") {
    const questionCount = initialQuizQuestions(data.pack).length
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl space-y-7 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">Quiz ready</p>
              {data.modelId === LOCAL_LEARNING_PACK_MODEL ? (
                <Badge variant="muted">Local preview</Badge>
              ) : null}
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              {data.skillTitle}
            </h1>
            <p className="mt-3 text-muted-foreground">{questionCount} questions</p>
          </div>

          <details className="border-y border-border py-3 text-sm">
            <summary className="min-h-11 cursor-pointer py-2 font-medium">
              What this covers
            </summary>
            <div className="space-y-3 pb-2 text-muted-foreground">
              <ul aria-label="Quiz coverage" className="flex flex-wrap gap-2">
                {data.pack.competencies.map((competency) => (
                  <li
                    key={competency.id}
                    className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground"
                  >
                    {competency.title}
                  </li>
                ))}
              </ul>
              <p>New-angle questions stay hidden until a later recall.</p>
            </div>
          </details>

          <div className="flex flex-col gap-2 sm:flex-row">
            <ButtonLink href={`/skills/${goalSkillId}/quiz?start=1`} size="lg">
              Start quiz
            </ButtonLink>
            <ButtonLink href={`/skills/${goalSkillId}/sources`} variant="ghost">
              Back to sources
            </ButtonLink>
          </div>
        </div>
      </AppShell>
    )
  }

  const draft = await getQuizDraft(session.user.id, data.packVersionId)
  return (
    <AppShell>
      <div className="space-y-7 py-4">
        <h1 className="sr-only">{data.skillTitle} initial quiz</h1>
        <InitialQuiz
          key={data.packVersionId}
          initialDraft={draft}
          goalSkillId={data.goalSkillId}
          packVersionId={data.packVersionId}
          questions={visibleInitialQuizQuestions(data.pack)}
        />
      </div>
    </AppShell>
  )
}
