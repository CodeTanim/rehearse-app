import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { FileStorage } from '@/lib/file-storage-server'
import { findOwnedFile } from '@/lib/owned-file-server'
import {
  createContentDisposition,
  createPrivateFileHeaders,
  privateFileError,
} from '@/lib/private-file-response'

type Params = {
  fileId: string
}

// GET /api/files/[fileId]/download - Download an owned file.
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

    try {
      const filePath = FileStorage.getFilePath(file.skillFolderId, file.filename)
      const fileBuffer = await FileStorage.getFileStream(filePath)
      const headers = createPrivateFileHeaders({
        contentType: 'application/octet-stream',
        contentLength: fileBuffer.byteLength,
        disposition: createContentDisposition('attachment', file.originalName),
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
