import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { FileStorage } from '@/lib/file-storage-server'
import { findOwnedFile } from '@/lib/owned-file-server'
import {
  createContentDisposition,
  createPrivateFileHeaders,
  getPreviewContentType,
  privateFileError,
} from '@/lib/private-file-response'

type Params = {
  fileId: string
}

// GET /api/files/[fileId]/view - View/preview an owned file.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<Params> }
) {
  const params = await context.params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return privateFileError('Unauthorized', 401)
    }

    const file = await findOwnedFile(session.user.id, params.fileId)
    if (!file) {
      // Do not reveal whether a file exists for another user.
      return privateFileError('File not found', 404)
    }

    const contentType = getPreviewContentType(file.mimeType)
    if (!contentType) {
      return privateFileError('This file type cannot be previewed safely', 415)
    }

    try {
      const filePath = FileStorage.getFilePath(file.skillFolderId, file.filename)
      const fileBuffer = await FileStorage.getFileStream(filePath)
      const headers = createPrivateFileHeaders({
        contentType,
        contentLength: fileBuffer.byteLength,
        disposition: createContentDisposition('inline', file.originalName),
      })

      return new NextResponse(fileBuffer as unknown as BodyInit, {
        status: 200,
        headers,
      })
    } catch {
      return privateFileError('File not found on storage', 404)
    }
  } catch {
    return privateFileError('Internal server error', 500)
  }
}
