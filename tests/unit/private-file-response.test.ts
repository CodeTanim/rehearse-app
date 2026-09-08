import { describe, expect, it } from 'vitest'
import {
  createContentDisposition,
  createPrivateFileHeaders,
  getPreviewContentType,
} from '@/lib/private-file-response'

describe('private file response policy', () => {
  it('allows only inert or explicitly previewable content types', () => {
    expect(getPreviewContentType('application/pdf')).toBe('application/pdf')
    expect(getPreviewContentType('image/png')).toBe('image/png')
    expect(getPreviewContentType('text/markdown')).toBe('text/plain; charset=utf-8')
    expect(getPreviewContentType('text/html')).toBeNull()
    expect(getPreviewContentType('image/svg+xml')).toBeNull()
    expect(getPreviewContentType('text/javascript')).toBeNull()
  })

  it('creates a quoted ASCII fallback and encoded UTF-8 filename without controls', () => {
    const disposition = createContentDisposition('attachment', 'réport"/\\\r\n.pdf')

    expect(disposition).toContain('attachment; filename="re_port___.pdf"')
    expect(disposition).toContain("filename*=UTF-8''r%C3%A9port%22%2F%5C.pdf")
    expect(disposition).not.toContain('\r')
    expect(disposition).not.toContain('\n')
  })

  it('handles malformed Unicode in a stored legacy filename', () => {
    expect(() => createContentDisposition('inline', 'bad\ud800name.pdf')).not.toThrow()
  })

  it('adds no-store, nosniff, same-origin, and sandbox headers', () => {
    const headers = createPrivateFileHeaders({
      contentType: 'application/pdf',
      contentLength: 42,
      disposition: createContentDisposition('inline', 'source.pdf'),
    })

    expect(headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(headers.get('x-content-type-options')).toBe('nosniff')
    expect(headers.get('cross-origin-resource-policy')).toBe('same-origin')
    expect(headers.get('content-security-policy')).toContain('sandbox')
    expect(headers.get('content-length')).toBe('42')
  })
})
