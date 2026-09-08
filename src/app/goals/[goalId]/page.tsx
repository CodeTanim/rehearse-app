import { notFound, redirect } from "next/navigation"
import { AppShell } from "@/components/app/app-shell"
import { SkillRelationships } from "@/components/learning/skill-relationships"
import { SkillTree } from "@/components/learning/skill-tree"
import { auth } from "@/lib/auth"
import { getOwnedSkillTree } from "@/lib/learning/skill-tree-query"
import { prisma } from "@/lib/prisma"

export const metadata = { title: "Skill Tree" }
export const dynamic = "force-dynamic"

export default async function GoalPage({ params }: { params: Promise<{ goalId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const { goalId } = await params
  const [tree, user] = await Promise.all([
    getOwnedSkillTree(session.user.id, goalId),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    }),
  ])

  if (!tree) notFound()

  return (
    <AppShell wide>
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
    </AppShell>
  )
}
