import { prisma } from '@/lib/prisma'

export type OwnedFile = {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  skillFolderId: string
}

/**
 * Resolves a file through its owning folder. A file ID is never sufficient
 * authorization on its own.
 */
export async function findOwnedFile(userId: string, fileId: string): Promise<OwnedFile | null> {
  return prisma.file.findFirst({
    where: {
      id: fileId,
      skillFolder: {
        userId,
      },
    },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
      size: true,
      skillFolderId: true,
    },
  })
}
