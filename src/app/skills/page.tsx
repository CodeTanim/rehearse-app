import { redirect } from "next/navigation"
import { AppShell } from "@/components/app/app-shell"
import { SkillRelationships } from "@/components/learning/skill-relationships"
import { SkillTree } from "@/components/learning/skill-tree"
import { ButtonLink } from "@/components/ui/button-link"
import { auth } from "@/lib/auth"
import { getUserSkillGarden } from "@/lib/learning/skill-tree-query"
import { prisma } from "@/lib/prisma"

export const metadata = { title: "Skill Tree" }
export const dynamic = "force-dynamic"

export default async function SkillsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login?returnTo=/skills")

  const [tree, user] = await Promise.all([
    getUserSkillGarden(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    }),
  ])

  return (
    <AppShell wide>
      {tree ? (
        <div className="space-y-5">
          <SkillTree
            leaves={tree.leaves}
            goalTitle={tree.goalTitle}
            headingLevel="h1"
            relationships={tree.relationships}
            timezone={user?.timezone ?? "UTC"}
          />
          <SkillRelationships leaves={tree.leaves} relationships={tree.relationships} />
        </div>
      ) : (
        <div className="mx-auto max-w-xl py-10 sm:py-20">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Skill Tree</h1>
          <p className="mt-3 text-sm text-muted-foreground">Add a skill to start your tree.</p>
          <ButtonLink href="/today/new" variant="outline" className="mt-7 w-full sm:w-auto">
            Add skill
          </ButtonLink>
        </div>
      )}
    </AppShell>
  )
}
