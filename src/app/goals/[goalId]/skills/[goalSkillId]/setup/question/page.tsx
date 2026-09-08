import { notFound, redirect } from "next/navigation"
import { QuestionSetupForm } from "@/components/learning/setup-forms"
import { SetupFrame } from "@/components/learning/setup-frame"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const metadata = { title: "Add a recall" }

export default async function NewQuestionPage({
  params,
}: {
  params: Promise<{ goalId: string; goalSkillId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const { goalId, goalSkillId } = await params
  const goalSkill = await prisma.goalSkill.findFirst({
    where: { id: goalSkillId, goalId, userId: session.user.id },
    select: { id: true },
  })

  if (!goalSkill) notFound()

  return (
    <SetupFrame step={3} title="Add a recall">
      <QuestionSetupForm goalSkillId={goalSkill.id} />
    </SetupFrame>
  )
}
