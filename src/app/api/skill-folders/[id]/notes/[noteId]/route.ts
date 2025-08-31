import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters').optional(),
  content: z.string().min(1, 'Content is required').optional(),
})

type Params = {
  id: string
  noteId: string
}

// GET /api/skill-folders/[id]/notes/[noteId] - Get specific note
export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  const params = await context.params
  
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify skill folder belongs to user and note exists
    const note = await prisma.note.findFirst({
      where: {
        id: params.noteId,
        skillFolder: {
          id: params.id,
          userId: session.user.id
        }
      },
      include: {
        skillFolder: true
      }
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error fetching note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/skill-folders/[id]/notes/[noteId] - Update a note
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  const params = await context.params
  
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify skill folder belongs to user and note exists
    const existingNote = await prisma.note.findFirst({
      where: {
        id: params.noteId,
        skillFolder: {
          id: params.id,
          userId: session.user.id
        }
      }
    })

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateNoteSchema.parse(body)

    // If title is being updated, check for duplicates
    if (validatedData.title && validatedData.title !== existingNote.title) {
      const titleConflict = await prisma.note.findFirst({
        where: {
          skillFolderId: params.id,
          title: validatedData.title,
          id: { not: params.noteId }
        }
      })

      if (titleConflict) {
        return NextResponse.json(
          { error: 'A note with this title already exists in this folder' },
          { status: 409 }
        )
      }
    }

    // Update note
    const updatedNote = await prisma.note.update({
      where: {
        id: params.noteId
      },
      data: validatedData
    })

    return NextResponse.json(updatedNote)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/skill-folders/[id]/notes/[noteId] - Delete a note
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  const params = await context.params
  
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify skill folder belongs to user and note exists
    const existingNote = await prisma.note.findFirst({
      where: {
        id: params.noteId,
        skillFolder: {
          id: params.id,
          userId: session.user.id
        }
      }
    })

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Delete note
    await prisma.note.delete({
      where: {
        id: params.noteId
      }
    })

    return NextResponse.json({ message: 'Note deleted successfully' })
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}