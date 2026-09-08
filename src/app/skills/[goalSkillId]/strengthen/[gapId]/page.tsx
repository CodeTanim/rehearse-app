import { ArrowLeftIcon, LeafIcon } from "lucide-react"
import { notFound, redirect } from "next/navigation"

import { AppShell } from "@/components/app/app-shell"
import { RemediationForm } from "@/components/learning/remediation-form"
import { ButtonLink } from "@/components/ui/button-link"
import { auth } from "@/lib/auth"
import {
  getOwnedLearningGap,
  LearningGapNotFoundError,
} from "@/lib/learning/remediation-service"

export const metadata = { title: "Strengthen this" }
export const dynamic = "force-dynamic"

export default async function StrengthenPage({
  params,
}: {
  params: Promise<{ goalSkillId: string; gapId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const { goalSkillId, gapId } = await params
  let gap
  try {
    gap = await getOwnedLearningGap(session.user.id, goalSkillId, gapId)
  } catch (error) {
    if (error instanceof LearningGapNotFoundError) notFound()
    throw error
  }

  if (!gap) notFound()

  const { remediation } = gap
  const activity = remediation.activity

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-5 py-4 sm:py-8">
        <ButtonLink
          href="/today"
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          Today
        </ButtonLink>

        <section className="relative overflow-hidden rounded-[2rem_2rem_2rem_0.75rem] border border-border bg-card p-5 shadow-[0_22px_60px_rgb(31_54_43/0.07)] sm:p-8">
          <div
            aria-hidden="true"
            className="absolute -right-9 -top-10 size-32 rotate-12 rounded-[70%_30%_65%_35%] bg-sage-light/75"
          />
          <div className="relative space-y-7">
            <header className="space-y-3">
              <span className="inline-flex size-9 items-center justify-center rounded-[65%_35%_65%_35%] bg-sage-light text-success">
                <LeafIcon aria-hidden="true" className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-success">
                  Strengthen · {gap.skillTitle}
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {remediation.gapLabel}
                </h1>
                <p className="mt-3 max-w-xl leading-7 text-muted-foreground">
                  {remediation.recommendedAction}
                </p>
              </div>
            </header>

            <div className="rounded-[1.25rem_1.25rem_1.25rem_0.4rem] border border-border bg-muted/70 p-4 sm:p-5">
              <p className="text-sm leading-6">{remediation.explanation}</p>
              {remediation.workedExample ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                  {remediation.workedExample}
                </p>
              ) : null}
            </div>

            <details className="group border-y border-border py-2 text-sm">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-2 font-medium">
                Source
                <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="space-y-2 pb-3">
                <p className="break-words text-muted-foreground">
                  {remediation.citation.sourceName} · {remediation.citation.locator}
                </p>
                <blockquote className="break-words border-l-2 border-primary pl-3 leading-6">
                  “{remediation.citation.excerpt}”
                </blockquote>
                {remediation.citation.sourceUrl ? (
                  <a
                    href={remediation.citation.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block min-h-11 py-2.5 font-medium text-link underline underline-offset-4 hover:text-link-hover"
                  >
                    Open source
                  </a>
                ) : null}
              </div>
            </details>

            <RemediationForm
              goalSkillId={goalSkillId}
              gapId={gapId}
              remediationRevisionId={remediation.id}
              scaffoldPrompt={remediation.scaffoldPrompt}
              initialAnswer={activity?.answer}
              alreadyCompleted={Boolean(activity)}
            />
          </div>
        </section>
      </div>
    </AppShell>
  )
}
