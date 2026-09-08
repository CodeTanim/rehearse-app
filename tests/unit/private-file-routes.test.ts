import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findOwnedFile: vi.fn(),
  getFilePath: vi.fn(),
  getFileStream: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/owned-file-server', () => ({ findOwnedFile: mocks.findOwnedFile }))
vi.mock('@/lib/file-storage-server', () => ({
  FileStorage: {
    getFilePath: mocks.getFilePath,
    getFileStream: mocks.getFileStream,
  },
}))

import { GET as downloadFile } from '@/app/api/files/[fileId]/download/route'
import { GET as viewFile } from '@/app/api/files/[fileId]/view/route'

const ownedFile = {
  id: 'file-a',
  filename: 'stored.pdf',
  originalName: 'source.pdf',
  mimeType: 'application/pdf',
  size: 7,
  skillFolderId: 'folder-a',
}

function request(path: string) {
  return new NextRequest(`http://localhost${path}`)
}

function context(fileId = 'file-a') {
  return { params: Promise.resolve({ fileId }) }
}

describe('private file routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getFilePath.mockReturnValue('/safe/stored.pdf')
    mocks.getFileStream.mockResolvedValue(Buffer.from('%PDF-x'))
  })

  it.each([
    ['view', viewFile, '/api/files/file-a/view'],
    ['download', downloadFile, '/api/files/file-a/download'],
  ])('returns 401 before lookup for an anonymous %s request', async (_name, handler, path) => {
    mocks.auth.mockResolvedValue(null)

    const response = await handler(request(path), context())

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(mocks.findOwnedFile).not.toHaveBeenCalled()
    expect(mocks.getFileStream).not.toHaveBeenCalled()
  })

  it.each([
    ['view', viewFile, '/api/files/file-a/view'],
    ['download', downloadFile, '/api/files/file-a/download'],
  ])('returns safe 404 for a missing or foreign %s file', async (_name, handler, path) => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-b' } })
    mocks.findOwnedFile.mockResolvedValue(null)

    const response = await handler(request(path), context())

    expect(response.status).toBe(404)
    expect(mocks.findOwnedFile).toHaveBeenCalledWith('user-b', 'file-a')
    expect(mocks.getFileStream).not.toHaveBeenCalled()
  })

  it('serves an owned preview with private hardened headers', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-a' } })
    mocks.findOwnedFile.mockResolvedValue(ownedFile)

    const response = await viewFile(request('/api/files/file-a/view'), context())

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toContain('inline')
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin')
    expect(mocks.getFilePath).toHaveBeenCalledWith('folder-a', 'stored.pdf')
  })

  it('refuses to preview a legacy active-content file', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-a' } })
    mocks.findOwnedFile.mockResolvedValue({ ...ownedFile, mimeType: 'text/html' })

    const response = await viewFile(request('/api/files/file-a/view'), context())

    expect(response.status).toBe(415)
    expect(mocks.getFileStream).not.toHaveBeenCalled()
  })

  it('downloads an owned file as an opaque attachment', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-a' } })
    mocks.findOwnedFile.mockResolvedValue({ ...ownedFile, mimeType: 'text/html' })

    const response = await downloadFile(request('/api/files/file-a/download'), context())

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/octet-stream')
    expect(response.headers.get('content-disposition')).toContain('attachment')
    expect(response.headers.get('content-security-policy')).toContain('sandbox')
  })
})
