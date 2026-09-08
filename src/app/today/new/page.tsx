import { redirect } from "next/navigation"
import { TopicSetupForm } from "@/components/learning/setup-forms"
import { SetupFrame } from "@/components/learning/setup-frame"
import { auth } from "@/lib/auth"

export const metadata = { title: "Add a skill" }

export default async function NewGoalPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login?returnTo=/today/new")

  return (
    <SetupFrame step={1} title="What do you want to learn?">
      <TopicSetupForm />
    </SetupFrame>
  )
}
