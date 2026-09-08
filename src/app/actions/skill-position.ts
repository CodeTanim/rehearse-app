"use server"

import { auth } from "@/lib/auth"
import { saveSkillPosition, skillPositionSchema } from "@/lib/learning/skill-position-service"

export async function saveSkillPositionAction(input: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Sign in again to save your map." }
  const parsed = skillPositionSchema.safeParse(input)
  if (!parsed.success) return { error: "That position is outside the map." }
  try {
    return await saveSkillPosition(session.user.id, parsed.data)
  } catch {
    return { error: "The position could not be saved. Try moving the skill again." }
  }
}
