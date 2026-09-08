import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AppShell } from "@/components/app/app-shell"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button-link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserSkillGarden } from "@/lib/learning/skill-tree-query"
import { getSkillSourceSetup } from "@/lib/learning/source-service"

export const metadata = { title: "Skill overview" }
export const dynamic = "force-dynamic"

export default async function SkillPage({ params }: { params: Promise<{ goalSkillId: string }> }) {
  const { goalSkillId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect(`/auth/login?returnTo=${encodeURIComponent(`/skills/${goalSkillId}`)}`)
  const userId = session.user.id
  const [garden, sources, pack, gaps, user] = await Promise.all([
    getUserSkillGarden(userId),
    getSkillSourceSetup({ userId, goalSkillId }),
    prisma.learningPack.findFirst({ where: { userId, goalSkillId, goalSkill: { userId } },
      select: { currentVersion: { select: { _count: { select: { attempts: true } } } } } }),
    prisma.learningGap.findMany({ where: { userId, goalSkillId, status: "OPEN", goalSkill: { userId } },
      orderBy: { openedAt: "asc" }, select: { id: true, remediationRevisions: { orderBy: { revision: "desc" }, take: 1,
        select: { gapLabel: true, activities: { where: { userId }, take: 1, select: { id: true } } } } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
  ])
  const leaf = garden?.leaves.find((item) => item.goalSkillId === goalSkillId)
  if (!leaf || !sources) notFound()
  const gap = gaps.find((item) => item.remediationRevisions[0]?.activities.length === 0)
  const quizReady = pack?.currentVersion && pack.currentVersion._count.attempts === 0
  const due = leaf.dueState === "DUE" || leaf.dueState === "OVERDUE"
  const href = quizReady ? `/skills/${goalSkillId}/quiz?start=1` :
    gap ? `/skills/${goalSkillId}/strengthen/${gap.id}` :
    due ? `/today?skill=${encodeURIComponent(goalSkillId)}` : `/skills/${goalSkillId}/sources`
  const label = quizReady ? "Continue quiz" : gap ? "Strengthen" : due ? "Review now" : sources.sources.length ? "Manage sources" : "Add sources"

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-7">
        <Link href="/skills" className="inline-block rounded-sm text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Back to tree</Link>
        <header>
          <Badge variant={leaf.stage === "WELL_LEARNED" ? "learned" : leaf.stage === "DEMONSTRATED" ? "demonstrated" : leaf.stage === "LEARNING" ? "learning" : "muted"}>
            {leaf.stage.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())}
          </Badge>
          <h1 className="mt-3 break-words font-display text-3xl font-semibold">{leaf.title}</h1>
          <p className="mt-3 text-muted-foreground">{leaf.outcome || `Learn ${leaf.title} from your sources.`}</p>
        </header>
        <ButtonLink href={href}>{label}</ButtonLink>
        <section className="border-y border-border py-5" aria-label="Learning evidence">
          <h2 className="font-semibold">Your learning</h2>
          <p className="mt-2 text-sm text-muted-foreground">{leaf.reason}</p>
          <p className="mt-2 text-sm">{leaf.evidenceCount} recall sessions · {leaf.successCount} review days</p>
          <p className="mt-2 text-sm text-muted-foreground">{leaf.dueAt ? `Next recall: ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: user?.timezone ?? "UTC" }).format(leaf.dueAt)}` : quizReady ? "Recall starts after your initial quiz." : "No recall scheduled yet."}</p>
        </section>
        {gaps.length ? <section aria-label="Ideas to strengthen">
          <h2 className="font-semibold">Ideas to strengthen</h2>
          <ul className="mt-3 space-y-2 text-sm">{gaps.map((item) => <li key={item.id}>
            <Link href={`/skills/${goalSkillId}/strengthen/${item.id}`} className="underline underline-offset-4">{item.remediationRevisions[0]?.gapLabel ?? "Review this idea"}</Link>
            {item.remediationRevisions[0]?.activities.length ? <span className="ml-2 text-muted-foreground">Practiced · awaiting recall</span> : null}
          </li>)}</ul>
        </section> : null}
        <section aria-label="Skill sources">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Sources ({sources.sources.length})</h2>
            <Link href={`/skills/${goalSkillId}/sources`} className="text-sm underline underline-offset-4">Manage sources</Link></div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">{sources.sources.map((source) => <li key={source.sourceId} className="break-words">{source.displayName} · {source.locator}</li>)}</ul>
        </section>
        <details className="border-t border-border pt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">What this skill covers</summary>
          <p className="pb-3 text-sm text-muted-foreground">{leaf.successCriterion || "Add sources and complete the initial quiz to establish this skill’s learning scope."}</p>
        </details>
      </div>
    </AppShell>
  )
}
