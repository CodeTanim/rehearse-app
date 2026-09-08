import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FileStorage } from '@/lib/file-storage-server'
import { withStorageMutationLock } from '@/lib/storage-mutation-lock'
import { z } from 'zod'

const updateSkillFolderSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters').optional(),
  description: z.string().trim().max(500, 'Description must be 500 characters or fewer').optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional()
})

// GET /api/skill-folders/[id] - Get a specific skill folder
export async function GET(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const skillFolder = await prisma.skillFolder.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      },
      include: {
        files: {
          orderBy: { uploadedAt: 'desc' }
        },
        notes: {
          orderBy: { createdAt: 'desc' }
        },
        qaPairs: {
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            files: true,
            notes: true,
            qaPairs: true
          }
        }
      }
    })

    if (!skillFolder) {
      return NextResponse.json({ error: 'Skill folder not found' }, { status: 404 })
    }

    return NextResponse.json(skillFolder)
  } catch (error) {
    console.error('Error fetching skill folder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/skill-folders/[id] - Update a skill folder
export async function PUT(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateSkillFolderSchema.parse(body)

    const existingFolder = await prisma.skillFolder.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!existingFolder) {
      return NextResponse.json({ error: 'Skill folder not found' }, { status: 404 })
    }

    // If name is being updated, check for uniqueness
    if (validatedData.name && validatedData.name !== existingFolder.name) {
      const nameConflict = await prisma.skillFolder.findUnique({
        where: {
          userId_name: {
            userId: session.user.id,
            name: validatedData.name
          }
        }
      })

      if (nameConflict) {
        return NextResponse.json(
          { error: 'A skill folder with this name already exists' },
          { status: 409 }
        )
      }
    }

    const updatedFolder = await prisma.skillFolder.update({
      where: {
        id: params.id
      },
      data: validatedData,
      include: {
        _count: {
          select: {
            files: true,
            notes: true,
            qaPairs: true
          }
        }
      }
    })

    return NextResponse.json(updatedFolder)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating skill folder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/skill-folders/[id] - Delete a skill folder
export async function DELETE(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    return withStorageMutationLock(async () => {
      // Check ownership inside the same local mutation lock used by uploads.
      const existingFolder = await prisma.skillFolder.findFirst({
        where: {
          id: params.id,
          userId
        }
      })

      if (!existingFolder) {
        return NextResponse.json({ error: 'Skill folder not found' }, { status: 404 })
      }

      try {
        // Stored bytes are removed first so a storage failure never erases the
        // metadata an operator needs to locate and retry the cleanup.
        await FileStorage.deleteSkillFolderFiles(params.id)
      } catch (storageError) {
        console.error('Error deleting skill folder storage:', {
          skillFolderId: params.id,
          error: storageError,
        })
        return NextResponse.json(
          {
            code: 'FOLDER_STORAGE_DELETE_FAILED',
            error: 'Stored files could not be removed. The skill folder was not deleted; check storage permissions and retry.',
          },
          { status: 500 }
        )
      }

      try {
        // Cascade handles the related metadata only after storage succeeds.
        await prisma.skillFolder.delete({
          where: {
            id: params.id
          }
        })
      } catch (databaseError) {
        console.error('Stored files were removed but skill folder metadata deletion failed:', {
          skillFolderId: params.id,
          error: databaseError,
        })
        return NextResponse.json(
          {
            code: 'FOLDER_METADATA_DELETE_FAILED',
            error: 'Stored files were removed, but the skill folder record could not be deleted. Retry to finish cleanup.',
          },
          { status: 500 }
        )
      }

      return NextResponse.json({ message: 'Skill folder deleted successfully' })
    })
  } catch (error) {
    console.error('Error deleting skill folder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
