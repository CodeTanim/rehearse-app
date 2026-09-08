import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  FileStorage,
  STORAGE_CONFIG,
  USER_UPLOAD_QUOTAS,
} from '@/lib/file-storage-server'
import { FileUtils, type UploadedFile } from '@/lib/file-utils'
import { withStorageMutationLock } from '@/lib/storage-mutation-lock'
import {
  isUploadAdmissionQueueFullError,
  isUploadRequestCancelledError,
  throwIfUploadCancelled,
  withLocalUploadAdmission,
} from '@/lib/upload-admission-limiter'

const MAX_MULTIPART_OVERHEAD = 1024 * 1024
const DUPLICATE_FILE_ERROR = {
  code: 'DUPLICATE_FILE_NAME',
  error: 'A file with this name already exists in this folder',
} as const

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

function uploadCancelledResponse() {
  return NextResponse.json(
    {
      code: 'UPLOAD_CANCELLED',
      error: 'Upload cancelled.',
    },
    {
      status: 499,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}

function uploadQueueFullResponse() {
  return NextResponse.json(
    {
      code: 'UPLOAD_QUEUE_FULL',
      error: 'The local upload queue is full. Wait a moment, then retry.',
    },
    {
      status: 503,
      headers: { 'Retry-After': '1' },
    },
  )
}

async function rollbackStoredUpload(
  uploadedFile: UploadedFile,
  context: {
    skillFolderId: string
    reason: 'database-error' | 'cancelled'
    metadataExists?: boolean
  },
): Promise<NextResponse | null> {
  try {
    await FileStorage.deleteFile(uploadedFile.path)
    return null
  } catch (cleanupError) {
    console.error('Upload rollback left an orphaned storage object.', {
      skillFolderId: context.skillFolderId,
      storedFilename: uploadedFile.filename,
      reason: context.reason,
      error: cleanupError,
    })
    return NextResponse.json(
      context.metadataExists
        ? {
            code: 'UPLOAD_CANCELLATION_ROLLBACK_FAILED',
            error: 'The cancelled upload could not be removed from storage. Its record was retained so cleanup can be retried.',
          }
        : {
            code: 'UPLOAD_ROLLBACK_FAILED',
            error: 'The upload could not be saved and its stored bytes could not be cleaned up. Remove the orphaned upload and retry.',
          },
      { status: 500 },
    )
  }
}

async function rollbackCancelledPersistedUpload(
  fileId: string,
  uploadedFile: UploadedFile,
  skillFolderId: string,
): Promise<NextResponse | null> {
  const storageFailure = await rollbackStoredUpload(uploadedFile, {
    skillFolderId,
    reason: 'cancelled',
    metadataExists: true,
  })

  // Keep metadata whenever byte removal fails so the orphan remains locatable.
  if (storageFailure) return storageFailure

  try {
    await prisma.file.delete({ where: { id: fileId } })
    return null
  } catch (metadataError) {
    console.error('Cancelled upload bytes were removed but metadata rollback failed.', {
      fileId,
      skillFolderId,
      error: metadataError,
    })
    return NextResponse.json(
      {
        code: 'UPLOAD_METADATA_ROLLBACK_FAILED',
        error: 'The cancelled upload bytes were removed, but its record could not be cleaned up. Retry deletion to finish cleanup.',
      },
      { status: 500 },
    )
  }
}

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
    const userId = session.user.id

    // Verify skill folder belongs to user
    const skillFolder = await prisma.skillFolder.findFirst({
      where: {
        id: params.id,
        userId
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
    const userId = session.user.id

    // Verify skill folder belongs to user
    const skillFolder = await prisma.skillFolder.findFirst({
      where: {
        id: params.id,
        userId
      }
    })

    if (!skillFolder) {
      return NextResponse.json({ error: 'Skill folder not found' }, { status: 404 })
    }

    const contentLengthHeader = request.headers.get('content-length')
    if (!contentLengthHeader) {
      return NextResponse.json(
        { error: 'A valid Content-Length header is required for uploads.' },
        { status: 411 }
      )
    }

    const contentLength = Number(contentLengthHeader)
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
      return NextResponse.json(
        { error: 'The upload size header is invalid.' },
        { status: 400 }
      )
    }

    if (contentLength > STORAGE_CONFIG.maxFileSize + MAX_MULTIPART_OVERHEAD) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${FileUtils.formatFileSize(STORAGE_CONFIG.maxFileSize)}.` },
        { status: 413 }
      )
    }

    return await withLocalUploadAdmission(request.signal, async () => {
      throwIfUploadCancelled(request.signal)

      let formData: FormData
      try {
        formData = await request.formData()
      } catch (parseError) {
        throwIfUploadCancelled(request.signal)
        throw parseError
      }

      const fileEntry = formData.get('file')
      if (!(fileEntry instanceof File)) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      // Validate metadata, extension, and file signatures before persisting bytes.
      const validation = await FileUtils.validateFileContent(fileEntry)
      throwIfUploadCancelled(request.signal)
      if (!validation.isValid) {
        const status = validation.code === 'file_too_large' ? 413 :
          validation.code === 'empty_file' || validation.code === 'invalid_filename' ? 400 : 415
        return NextResponse.json(
          { error: validation.error },
          { status },
        )
      }

      const file = fileEntry

      return withStorageMutationLock(async () => {
        // The storage lock can have its own wait after admission and validation.
        throwIfUploadCancelled(request.signal)

        // Recheck ownership after waiting for the mutation lock. A concurrent
        // folder deletion may have completed while the request body was parsed.
        const currentFolder = await prisma.skillFolder.findFirst({
          where: {
            id: params.id,
            userId,
          },
        })

        if (!currentFolder) {
          return NextResponse.json({ error: 'Skill folder not found' }, { status: 404 })
        }

        const [existingFile, uploadUsage] = await Promise.all([
          prisma.file.findFirst({
            where: {
              skillFolderId: params.id,
              originalName: file.name,
            },
          }),
          prisma.file.aggregate({
            where: {
              skillFolder: {
                userId,
              },
            },
            _count: { _all: true },
            _sum: { size: true },
          }),
        ])

        if (existingFile) {
          return NextResponse.json(DUPLICATE_FILE_ERROR, { status: 409 })
        }

        if (uploadUsage._count._all >= USER_UPLOAD_QUOTAS.maxFileCount) {
          return NextResponse.json(
            {
              code: 'UPLOAD_FILE_COUNT_QUOTA_EXCEEDED',
              error: `Upload limit reached. Each account can store up to ${USER_UPLOAD_QUOTAS.maxFileCount} files.`,
              limit: USER_UPLOAD_QUOTAS.maxFileCount,
            },
            { status: 409 },
          )
        }

        const currentTotalBytes = uploadUsage._sum.size ?? 0
        if (currentTotalBytes + file.size > USER_UPLOAD_QUOTAS.maxTotalBytes) {
          return NextResponse.json(
            {
              code: 'UPLOAD_TOTAL_BYTES_QUOTA_EXCEEDED',
              error: `Storage limit reached. Each account can store up to ${FileUtils.formatFileSize(USER_UPLOAD_QUOTAS.maxTotalBytes)}.`,
              limit: USER_UPLOAD_QUOTAS.maxTotalBytes,
            },
            { status: 413 },
          )
        }

        // Persist only while this process owns the serialized quota reservation.
        throwIfUploadCancelled(request.signal)
        const uploadedFile = await FileStorage.saveFile(file, params.id, validation.mimeType)

        if (request.signal.aborted) {
          const rollbackFailure = await rollbackStoredUpload(uploadedFile, {
            skillFolderId: params.id,
            reason: 'cancelled',
          })
          if (rollbackFailure) return rollbackFailure
          throwIfUploadCancelled(request.signal)
        }

        let dbFile
        try {
          // Save only the server-verified MIME type in the database.
          dbFile = await prisma.file.create({
            data: {
              filename: uploadedFile.filename,
              originalName: uploadedFile.originalName,
              mimeType: uploadedFile.mimeType,
              size: uploadedFile.size,
              skillFolderId: params.id,
            },
          })
        } catch (databaseError) {
          const rollbackFailure = await rollbackStoredUpload(uploadedFile, {
            skillFolderId: params.id,
            reason: 'database-error',
          })
          if (rollbackFailure) return rollbackFailure

          throwIfUploadCancelled(request.signal)
          if (isUniqueConstraintError(databaseError)) {
            return NextResponse.json(DUPLICATE_FILE_ERROR, { status: 409 })
          }

          console.error('Error saving upload metadata:', databaseError)
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }

        if (request.signal.aborted) {
          const rollbackFailure = await rollbackCancelledPersistedUpload(
            dbFile.id,
            uploadedFile,
            params.id,
          )
          if (rollbackFailure) return rollbackFailure
          throwIfUploadCancelled(request.signal)
        }

        return NextResponse.json(dbFile, { status: 201 })
      })
    })
  } catch (error) {
    if (isUploadRequestCancelledError(error) || request.signal.aborted) {
      return uploadCancelledResponse()
    }
    if (isUploadAdmissionQueueFullError(error)) {
      return uploadQueueFullResponse()
    }

    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
