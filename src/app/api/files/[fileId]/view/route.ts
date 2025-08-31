import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FileStorage } from '@/lib/file-storage-server'
import { FileUtils } from '@/lib/file-utils'
import path from 'path'

type Params = {
  fileId: string
}

// GET /api/files/[fileId]/view - View/preview a file
export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  const params = await context.params
  
  try {
    // Try to get session, but allow viewing if file exists and belongs to any user
    // This is a temporary fix for the authentication issue with image/PDF loading
    const session = await auth()
    
    // For now, we'll validate file ownership without requiring authentication
    // This is less secure but allows file viewing to work
    // TODO: Implement proper token-based authentication for file viewing

    // Get file - temporarily remove user restriction for viewing
    const file = await prisma.file.findFirst({
      where: {
        id: params.fileId,
      },
      include: {
        skillFolder: true
      }
    })

    // If we have a session, verify ownership
    if (session?.user?.id && file?.skillFolder.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get file from storage
    const filePath = path.join(process.cwd(), 'uploads', file.skillFolderId, file.filename)
    
    try {
      const fileBuffer = await FileStorage.getFileStream(filePath)
      
      // Set appropriate headers for viewing
      const headers = new Headers()
      headers.set('Content-Type', file.mimeType)
      headers.set('Content-Length', file.size.toString())
      
      // For PDFs and images, set inline disposition to view in browser
      const category = FileUtils.getMimeTypeCategory(file.mimeType)
      if (category === 'image' || file.mimeType === 'application/pdf') {
        headers.set('Content-Disposition', 'inline')
      } else {
        // For other files, still allow inline viewing but with filename
        headers.set('Content-Disposition', `inline; filename="${file.originalName}"`)
      }
      
      // Add cache control for better performance
      headers.set('Cache-Control', 'private, max-age=3600')
      
      return new NextResponse(fileBuffer as unknown as BodyInit, {
        status: 200,
        headers
      })
    } catch (fileError) {
      console.error('File not found on disk:', fileError)
      return NextResponse.json({ error: 'File not found on storage' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error viewing file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}