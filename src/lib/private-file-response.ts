import { NextResponse } from 'next/server'

const INLINE_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown'])

type FileResponseMode = 'inline' | 'attachment'

export function getPreviewContentType(mimeType: string): string | null {
  if (INLINE_MIME_TYPES.has(mimeType)) return mimeType
  if (TEXT_MIME_TYPES.has(mimeType)) return 'text/plain; charset=utf-8'
  return null
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

export function createContentDisposition(mode: FileResponseMode, originalName: string): string {
  const withoutControls = originalName.toWellFormed().replace(/[\0\r\n]/g, '')
  const fallback = withoutControls
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\/]/g, '_')
    .slice(0, 180) || 'download'
  const encoded = encodeRfc5987Value(withoutControls || 'download')

  return `${mode}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export function createPrivateFileHeaders({
  contentType,
  contentLength,
  disposition,
}: {
  contentType: string
  contentLength: number
  disposition: string
}): Headers {
  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('Content-Length', contentLength.toString())
  headers.set('Content-Disposition', disposition)
  headers.set('Cache-Control', 'private, no-store, max-age=0')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  headers.set('Content-Security-Policy', "sandbox; default-src 'none'")
  headers.set('Vary', 'Cookie')
  return headers
}

export function privateFileError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        Vary: 'Cookie',
      },
    }
  )
}
