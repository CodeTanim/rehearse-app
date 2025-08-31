import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSkillFolderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters').optional(),
  description: z.string().optional(),
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

    // Check if the skill folder exists and belongs to the user
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

    // Check if the skill folder exists and belongs to the user
    const existingFolder = await prisma.skillFolder.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!existingFolder) {
      return NextResponse.json({ error: 'Skill folder not found' }, { status: 404 })
    }

    // Delete the skill folder (cascade will handle related data)
    await prisma.skillFolder.delete({
      where: {
        id: params.id
      }
    })

    return NextResponse.json({ message: 'Skill folder deleted successfully' })
  } catch (error) {
    console.error('Error deleting skill folder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}