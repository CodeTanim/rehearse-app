import { PrismaClient } from "@prisma/client"

const [email, skillTitle] = process.argv.slice(2)
const expectedDatabaseUrl = "file:./dev.local.db"

if (process.env.NODE_ENV === "production") {
  throw new Error("Local recall fixtures are disabled in production.")
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL !== expectedDatabaseUrl) {
  throw new Error(`This helper may use only ${expectedDatabaseUrl}.`)
}
if (!email || !skillTitle) {
  throw new Error("Usage: node scripts/set-recall-due.mjs <email> <skill-title>")
}

process.env.DATABASE_URL = expectedDatabaseUrl
const prisma = new PrismaClient()

try {
  const skill = await prisma.goalSkill.findFirst({
    where: {
      user: { email },
      skillNode: { title: skillTitle },
    },
    select: { userId: true, skillNodeId: true },
  })
  if (!skill) throw new Error("The requested local skill was not found.")

  const result = await prisma.reviewSchedule.updateMany({
    where: {
      userId: skill.userId,
      question: { skillNodeId: skill.skillNodeId, origin: "GENERATED" },
    },
    data: { dueAt: new Date(Date.now() - 60_000) },
  })
  if (result.count !== 6) {
    throw new Error(`Expected six generated recall items, found ${result.count}.`)
  }
} finally {
  await prisma.$disconnect()
}
