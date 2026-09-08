import { notFound, redirect } from "next/navigation"

import { GenerateQuizForm } from "@/components/learning/generate-quiz-form"
import { SetupFrame } from "@/components/learning/setup-frame"
import { SourceSetupForm } from "@/components/learning/source-setup-form"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getSkillSourceSetup } from "@/lib/learning/source-service"

export const metadata = { title: "Add sources" }
export const dynamic = "force-dynamic"

export default async function SkillSourcesPage({
  params,
}: {
  params: Promise<{ goalSkillId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const { goalSkillId } = await params
  const setup = await getSkillSourceSetup({
    userId: session.user.id,
    goalSkillId,
  })
  if (!setup) notFound()

  const hasSources = setup.sources.some((source) => source.status === "READY")

  return (
    <SetupFrame step={2} title="Add sources">
      <p className="-mt-5 mb-7 text-sm text-muted-foreground">{setup.skillTitle}</p>

      {hasSources ? (
        <div className="space-y-7">
          <ul aria-label="Sources" className="divide-y divide-border border-y border-border">
            {setup.sources.map((source) => (
              <li key={source.sourceId} className="flex min-w-0 items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{source.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{source.locator}</p>
                </div>
                <Badge variant="muted">Ready</Badge>
              </li>
            ))}
          </ul>

          <GenerateQuizForm goalSkillId={setup.goalSkillId} />

          <details className="border-t border-border pt-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
              Add another source
            </summary>
            <div className="pt-4">
              <SourceSetupForm goalSkillId={setup.goalSkillId} secondary />
            </div>
          </details>
        </div>
      ) : (
        <SourceSetupForm goalSkillId={setup.goalSkillId} />
      )}
    </SetupFrame>
  )
}
