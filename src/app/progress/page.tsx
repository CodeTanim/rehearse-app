import Link from "next/link"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app/app-shell"
import { ButtonLink } from "@/components/ui/button-link"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getUserSkillGarden } from "@/lib/learning/skill-tree-query"

export const metadata = { title: "Progress" }
export const dynamic = "force-dynamic"

export default async function ProgressPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login?returnTo=/progress")
  // Account progress is independent of today's recommended action.
  const garden = await getUserSkillGarden(session.user.id)
  const leaves = garden?.leaves ?? []
  const learned = leaves.filter((leaf) => leaf.stage === "WELL_LEARNED").length

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-7">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Progress</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {leaves.length ? `${leaves.length} skills · ${learned} well learned` : "Your learning evidence will appear here."}
          </p>
        </header>
        {leaves.length ? (
          <ul aria-label="Skill progress" className="divide-y divide-border border-y border-border">
            {leaves.map((leaf) => (
              <li key={leaf.goalSkillId} className="py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="min-w-0 break-words text-lg font-semibold">
                    <Link href={`/skills/${leaf.goalSkillId}`} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{leaf.title}</Link>
                  </h2>
                  <Badge variant={leaf.stage === "WELL_LEARNED" ? "learned" : leaf.stage === "DEMONSTRATED" ? "demonstrated" : leaf.stage === "LEARNING" ? "learning" : "muted"}>
                    {leaf.stage.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{leaf.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">{leaf.evidenceCount} recall sessions · {leaf.successCount} review days</p>
              </li>
            ))}
          </ul>
        ) : null}
        <ButtonLink href={leaves.length ? "/skills" : "/today/new"} variant="outline">
          {leaves.length ? "View tree" : "Add a skill"}
        </ButtonLink>
      </div>
    </AppShell>
  )
}
