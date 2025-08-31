import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSkillFolderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional()
})

// GET /api/skill-folders - Get all skill folders for the current user
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const skillFolders = await prisma.skillFolder.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        _count: {
          select: {
            files: true,
            notes: true,
            qaPairs: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(skillFolders)
  } catch (error) {
    console.error('Error fetching skill folders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/skill-folders - Create a new skill folder
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createSkillFolderSchema.parse(body)

    // Check if a folder with this name already exists for the user
    const existingFolder = await prisma.skillFolder.findUnique({
      where: {
        userId_name: {
          userId: session.user.id,
          name: validatedData.name
        }
      }
    })

    if (existingFolder) {
      return NextResponse.json(
        { error: 'A skill folder with this name already exists' },
        { status: 409 }
      )
    }

    const skillFolder = await prisma.skillFolder.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color,
        userId: session.user.id
      },
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

    return NextResponse.json(skillFolder, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating skill folder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}