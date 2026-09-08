import { notFound, redirect } from "next/navigation"
import { SkillSetupForm } from "@/components/learning/setup-forms"
import { SetupFrame } from "@/components/learning/setup-frame"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const metadata = { title: "Add a skill" }

export default async function NewSkillPage({
  params,
}: {
  params: Promise<{ goalId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const { goalId } = await params
  const goal = await prisma.learningGoal.findFirst({
    where: { id: goalId, userId: session.user.id },
    select: { id: true },
  })

  if (!goal) notFound()

  return (
    <SetupFrame step={2} title="Add a skill">
      <SkillSetupForm goalId={goal.id} />
    </SetupFrame>
  )
}
