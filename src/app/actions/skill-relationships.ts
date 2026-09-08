"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/lib/auth"
import {
  connectSkillRelationship,
  SkillRelationshipError,
  updateSkillRelationshipStatus,
} from "@/lib/learning/relationship-service"
import {
  firstValidationError,
  type LearningActionState,
} from "@/lib/learning/validation"

const kindSchema = z.enum(["RELATED", "PREREQUISITE"], {
  error: "Choose a connection type.",
})
const mutationSchema = z.object({
  relationshipId: z.string().trim().min(1).max(128),
  intent: z.enum(["ACCEPT", "DISMISS", "REMOVE"]),
})

function formString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export async function connectSkillRelationshipAction(
  _previousState: LearningActionState,
  formData: FormData,
): Promise<LearningActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Sign in to continue." }

  try {
    await connectSkillRelationship({
      userId: session.user.id,
      sourceGoalSkillId: formString(formData, "sourceGoalSkillId"),
      targetGoalSkillId: formString(formData, "targetGoalSkillId"),
      kind: kindSchema.parse(formString(formData, "kind")),
    })
  } catch (error) {
    if (error instanceof z.ZodError) return { error: firstValidationError(error) }
    if (error instanceof SkillRelationshipError) {
      return { error: error.publicMessage }
    }
    console.error(
      "Skill relationship creation failed.",
      error instanceof Error ? error.name : "UnknownError",
    )
    return { error: "The skills could not be connected. Try again." }
  }

  revalidatePath("/skills")
  return {}
}

export async function manageSkillRelationshipAction(formData: FormData): Promise<LearningActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Sign in to continue." }

  try {
    const mutation = mutationSchema.parse({
      relationshipId: formString(formData, "relationshipId"),
      intent: formString(formData, "intent"),
    })
    await updateSkillRelationshipStatus({
      userId: session.user.id,
      relationshipId: mutation.relationshipId,
      action: mutation.intent,
    })
  } catch (error) {
    if (error instanceof z.ZodError) return { error: firstValidationError(error) }
    if (error instanceof SkillRelationshipError) return { error: error.publicMessage }
    console.error(
      "Skill relationship update failed.",
      error instanceof Error ? error.name : "UnknownError",
    )
    return { error: "The connection could not be removed. Try again." }
  }

  revalidatePath("/skills")
  return {}
}
