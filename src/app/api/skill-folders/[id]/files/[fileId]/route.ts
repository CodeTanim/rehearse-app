import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FileStorage } from '@/lib/file-storage-server'
import path from 'path'

type Params = {
  id: string
  fileId: string
}

// GET /api/skill-folders/[id]/files/[fileId] - Get specific file metadata
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

    // Verify skill folder belongs to user and file exists
    const file = await prisma.file.findFirst({
      where: {
        id: params.fileId,
        skillFolder: {
          id: params.id,
          userId: session.user.id
        }
      },
      include: {
        skillFolder: true
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    return NextResponse.json(file)
  } catch (error) {
    console.error('Error fetching file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/skill-folders/[id]/files/[fileId] - Delete a file
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

    // Verify skill folder belongs to user and file exists
    const file = await prisma.file.findFirst({
      where: {
        id: params.fileId,
        skillFolder: {
          id: params.id,
          userId: session.user.id
        }
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Delete file from storage
    const filePath = path.join(process.cwd(), 'uploads', params.id, file.filename)
    await FileStorage.deleteFile(filePath)

    // Delete file record from database
    await prisma.file.delete({
      where: {
        id: params.fileId
      }
    })

    return NextResponse.json({ message: 'File deleted successfully' })
  } catch (error) {
    console.error('Error deleting file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}