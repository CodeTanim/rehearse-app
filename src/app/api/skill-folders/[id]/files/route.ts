import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FileStorage, STORAGE_CONFIG } from '@/lib/file-storage-server'
import { FileUtils } from '@/lib/file-utils'
import { z } from 'zod'

// Schema for potential future validation
// const uploadSchema = z.object({
//   file: z.instanceof(File),
// })

// GET /api/skill-folders/[id]/files - Get all files in a skill folder
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

    // Get all files in the skill folder
    const files = await prisma.file.findMany({
      where: {
        skillFolderId: params.id
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    })

    return NextResponse.json(files)
  } catch (error) {
    console.error('Error fetching files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/skill-folders/[id]/files - Upload a file to a skill folder
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file
    if (!FileUtils.isValidMimeType(file.type)) {
      return NextResponse.json(
        { error: 'File type not supported. Please upload images, documents, or text files.' },
        { status: 400 }
      )
    }

    if (!FileUtils.isValidFileSize(file.size)) {
      return NextResponse.json(
        { 
          error: `File too large. Maximum size is ${FileUtils.formatFileSize(STORAGE_CONFIG.maxFileSize)}.` 
        },
        { status: 400 }
      )
    }

    // Check for duplicate filenames in the same folder
    const existingFile = await prisma.file.findFirst({
      where: {
        skillFolderId: params.id,
        originalName: file.name
      }
    })

    if (existingFile) {
      return NextResponse.json(
        { error: 'A file with this name already exists in this folder' },
        { status: 409 }
      )
    }

    // Save file to storage
    const uploadedFile = await FileStorage.saveFile(file, params.id)

    // Save file metadata to database
    const dbFile = await prisma.file.create({
      data: {
        filename: uploadedFile.filename,
        originalName: uploadedFile.originalName,
        mimeType: uploadedFile.mimeType,
        size: uploadedFile.size,
        skillFolderId: params.id,
      }
    })

    return NextResponse.json(dbFile, { status: 201 })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}