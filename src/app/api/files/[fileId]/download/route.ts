import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FileStorage } from '@/lib/file-storage-server'
import path from 'path'

type Params = {
  fileId: string
}

// GET /api/files/[fileId]/download - Download a file
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

    // Verify file belongs to user's skill folder
    const file = await prisma.file.findFirst({
      where: {
        id: params.fileId,
        skillFolder: {
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

    // Get file from storage
    const filePath = path.join(process.cwd(), 'uploads', file.skillFolderId, file.filename)
    
    try {
      const fileBuffer = await FileStorage.getFileStream(filePath)
      
      // Set appropriate headers for download
      const headers = new Headers()
      headers.set('Content-Type', file.mimeType)
      headers.set('Content-Length', file.size.toString())
      headers.set('Content-Disposition', `attachment; filename="${file.originalName}"`)
      
      return new NextResponse(fileBuffer as unknown as BodyInit, {
        status: 200,
        headers
      })
    } catch (fileError) {
      console.error('File not found on disk:', fileError)
      return NextResponse.json({ error: 'File not found on storage' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error downloading file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}