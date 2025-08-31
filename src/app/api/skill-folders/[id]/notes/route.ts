import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  content: z.string().min(1, 'Content is required'),
})

// Schema for potential future use
// const updateNoteSchema = z.object({
//   title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters').optional(),
//   content: z.string().min(1, 'Content is required').optional(),
// })

// GET /api/skill-folders/[id]/notes - Get all notes in a skill folder
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

    // Verify skill folder belongs to user
    const skillFolder = await prisma.skillFolder.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!skillFolder) {
      return NextResponse.json({ error: 'Skill folder not found' }, { status: 404 })
    }

    // Get all notes in the skill folder
    const notes = await prisma.note.findMany({
      where: {
        skillFolderId: params.id
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/skill-folders/[id]/notes - Create a new note in a skill folder
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify skill folder belongs to user
    const skillFolder = await prisma.skillFolder.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!skillFolder) {
      return NextResponse.json({ error: 'Skill folder not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createNoteSchema.parse(body)

    // Check for duplicate note titles in the same folder
    const existingNote = await prisma.note.findFirst({
      where: {
        skillFolderId: params.id,
        title: validatedData.title
      }
    })

    if (existingNote) {
      return NextResponse.json(
        { error: 'A note with this title already exists in this folder' },
        { status: 409 }
      )
    }

    // Create note
    const note = await prisma.note.create({
      data: {
        title: validatedData.title,
        content: validatedData.content,
        skillFolderId: params.id,
      }
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}