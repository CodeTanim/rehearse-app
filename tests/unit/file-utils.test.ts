import { describe, expect, it } from 'vitest'
import { FileUtils, STORAGE_CONFIG } from '@/lib/file-utils'

describe('FileUtils', () => {
  it('allows only the narrow previewable source formats', () => {
    expect(FileUtils.isValidMimeType('application/pdf')).toBe(true)
    expect(FileUtils.isValidMimeType('text/markdown')).toBe(true)
    expect(FileUtils.isValidMimeType('image/svg+xml')).toBe(false)
    expect(FileUtils.isValidMimeType('text/html')).toBe(false)
    expect(FileUtils.isValidMimeType('text/javascript')).toBe(false)
    expect(FileUtils.isValidMimeType('application/zip')).toBe(false)
  })

  it('rejects empty, oversized, invalid, and mismatched metadata', () => {
    expect(FileUtils.validateFile({ name: 'empty.txt', size: 0, type: 'text/plain' })).toMatchObject({
      isValid: false,
      code: 'empty_file',
    })
    expect(FileUtils.validateFile({
      name: 'large.txt',
      size: STORAGE_CONFIG.maxFileSize + 1,
      type: 'text/plain',
    })).toMatchObject({ isValid: false, code: 'file_too_large' })
    expect(FileUtils.validateFile({ name: 'bad\nname.txt', size: 1, type: 'text/plain' })).toMatchObject({
      isValid: false,
      code: 'invalid_filename',
    })
    expect(FileUtils.validateFile({ name: 'notes.html', size: 1, type: 'text/html' })).toMatchObject({
      isValid: false,
      code: 'unsupported_type',
    })
    expect(FileUtils.validateFile({ name: 'image.pdf', size: 1, type: 'image/png' })).toMatchObject({
      isValid: false,
      code: 'extension_mismatch',
    })
  })

  it('accepts a PDF only when its signature matches', async () => {
    const validPdf = new File([new TextEncoder().encode('%PDF-1.7\nfixture')], 'source.pdf', {
      type: 'application/pdf',
    })
    const disguisedHtml = new File(['<html><script>alert(1)</script></html>'], 'source.pdf', {
      type: 'application/pdf',
    })

    await expect(FileUtils.validateFileContent(validPdf)).resolves.toEqual({
      isValid: true,
      mimeType: 'application/pdf',
    })
    await expect(FileUtils.validateFileContent(disguisedHtml)).resolves.toMatchObject({
      isValid: false,
      code: 'content_mismatch',
    })
  })

  it.each([
    ['photo.jpg', 'image/jpeg', [0xff, 0xd8, 0xff, 0x00]],
    ['photo.png', 'image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ['photo.gif', 'image/gif', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    ['photo.webp', 'image/webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
  ])('accepts the expected signature for %s', async (name, type, signature) => {
    const file = new File([new Uint8Array(signature)], name, { type })
    await expect(FileUtils.validateFileContent(file)).resolves.toMatchObject({ isValid: true })
  })

  it('requires valid, null-free UTF-8 for text files', async () => {
    const validText = new File(['# Notes\n\n<img onerror="alert(1)">'], 'notes.md', {
      type: 'text/markdown',
    })
    const invalidUtf8 = new File([new Uint8Array([0xc3, 0x28])], 'notes.txt', { type: 'text/plain' })
    const nullBytes = new File([new Uint8Array([0x61, 0, 0x62])], 'notes.txt', { type: 'text/plain' })

    await expect(FileUtils.validateFileContent(validText)).resolves.toMatchObject({ isValid: true })
    await expect(FileUtils.validateFileContent(invalidUtf8)).resolves.toMatchObject({
      isValid: false,
      code: 'content_mismatch',
    })
    await expect(FileUtils.validateFileContent(nullBytes)).resolves.toMatchObject({
      isValid: false,
      code: 'content_mismatch',
    })
  })
})
