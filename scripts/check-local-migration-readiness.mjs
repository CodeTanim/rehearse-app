import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function isMissingFilesTable(error) {
  if (!error || typeof error !== "object") return false

  const message = [error.message, error.meta?.message]
    .filter((value) => typeof value === "string")
    .join(" ")

  return message.includes("no such table") && message.includes("files")
}

try {
  let duplicateGroups = []

  try {
    duplicateGroups = await prisma.$queryRawUnsafe(`
      SELECT
        "skill_folder_id" AS "skillFolderId",
        COUNT(*) AS "duplicateCount"
      FROM "files"
      GROUP BY "skill_folder_id", "original_name"
      HAVING COUNT(*) > 1
      LIMIT 1
    `)
  } catch (error) {
    // A fresh database has no application tables until the first migration.
    if (!isMissingFilesTable(error)) throw error
  }

  if (duplicateGroups.length > 0) {
    const duplicate = duplicateGroups[0]
    console.error(
      "Local migration blocked: duplicate file names exist within one skill folder. " +
        `Folder ${String(duplicate.skillFolderId)} contains ${String(duplicate.duplicateCount)} records ` +
        "for the same original name. Rename or remove the duplicate records, or run " +
        "`npm run db:local:reset` only if this database contains disposable synthetic data.",
    )
    process.exitCode = 1
  }
} finally {
  await prisma.$disconnect()
}
