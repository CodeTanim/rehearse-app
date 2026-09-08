import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { POSITION_LIMIT } from "@/lib/learning/canvas-geometry"

export const skillPositionSchema = z.object({
  skillNodeId: z.string().trim().min(1).max(128),
  x: z.number().finite().min(-POSITION_LIMIT).max(POSITION_LIMIT),
  y: z.number().finite().min(-POSITION_LIMIT).max(POSITION_LIMIT),
  version: z.number().int().nonnegative(),
}).strict()

export async function saveSkillPosition(userId: string, input: z.infer<typeof skillPositionSchema>) {
  const position = skillPositionSchema.parse(input)
  const result = await prisma.skillNode.updateMany({
    where: {
      id: position.skillNodeId, kind: "SKILL", archivedAt: null,
      graph: { userId }, positionVersion: position.version,
      goalSkills: { some: { userId, lifecycle: { not: "ARCHIVED" }, goal: { userId } } },
    },
    data: { mapX: position.x, mapY: position.y, positionVersion: { increment: 1 } },
  })
  return result.count === 1
    ? { version: position.version + 1 }
    : { error: "This skill changed elsewhere or is unavailable. Reload the map before moving it again." }
}
