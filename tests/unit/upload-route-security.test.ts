import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findFolder: vi.fn(),
  findFile: vi.fn(),
  aggregateFiles: vi.fn(),
  createFile: vi.fn(),
  deleteFileRecord: vi.fn(),
  saveFile: vi.fn(),
  deleteFile: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    skillFolder: { findFirst: mocks.findFolder },
    file: {
      findFirst: mocks.findFile,
      aggregate: mocks.aggregateFiles,
      create: mocks.createFile,
      delete: mocks.deleteFileRecord,
    },
  },
}))
vi.mock('@/lib/file-storage-server', () => ({
  STORAGE_CONFIG: { maxFileSize: 10 * 1024 * 1024 },
  USER_UPLOAD_QUOTAS: {
    maxFileCount: 2,
    maxTotalBytes: 20,
  },
  FileStorage: {
    saveFile: mocks.saveFile,
    deleteFile: mocks.deleteFile,
  },
}))

import { POST } from '@/app/api/skill-folders/[id]/files/route'

function uploadRequest(file: File, signal?: AbortSignal): NextRequest {
  const body = new FormData()
  body.set('file', file)
  return new NextRequest('http://localhost/api/skill-folders/folder-a/files', {
    method: 'POST',
    body,
    headers: { 'content-length': String(file.size + 512) },
    signal,
  })
}

const context = { params: Promise.resolve({ id: 'folder-a' }) }

describe('secure upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-a' } })
    mocks.findFolder.mockResolvedValue({ id: 'folder-a', userId: 'user-a' })
    mocks.findFile.mockResolvedValue(null)
    mocks.aggregateFiles.mockResolvedValue({
      _count: { _all: 0 },
      _sum: { size: 0 },
    })
    mocks.saveFile.mockResolvedValue({
      filename: 'stored.pdf',
      originalName: 'source.pdf',
      mimeType: 'application/pdf',
      size: 12,
      path: '/safe/stored.pdf',
      hash: 'hash',
    })
    mocks.createFile.mockResolvedValue({ id: 'file-a' })
    mocks.deleteFileRecord.mockResolvedValue({ id: 'file-a' })
    mocks.deleteFile.mockResolvedValue(undefined)
  })

  it('rejects active content before writing storage', async () => {
    const file = new File(['<script>alert(1)</script>'], 'payload.html', { type: 'text/html' })

    const response = await POST(uploadRequest(file), context)

    expect(response.status).toBe(415)
    expect(mocks.saveFile).not.toHaveBeenCalled()
    expect(mocks.createFile).not.toHaveBeenCalled()
  })

  it('rejects a multipart upload without a bounded content length before parsing', async () => {
    const body = new FormData()
    body.set('file', new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' }))
    const request = new NextRequest('http://localhost/api/skill-folders/folder-a/files', {
      method: 'POST',
      body,
    })

    const response = await POST(request, context)

    expect(response.status).toBe(411)
    expect(mocks.saveFile).not.toHaveBeenCalled()
  })

  it('does not parse an upload when its request is already cancelled', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })
    const controller = new AbortController()
    const request = uploadRequest(file, controller.signal)
    const formDataSpy = vi.spyOn(request, 'formData')
    controller.abort()

    const response = await POST(request, context)

    expect(response.status).toBe(499)
    await expect(response.json()).resolves.toMatchObject({ code: 'UPLOAD_CANCELLED' })
    expect(formDataSpy).not.toHaveBeenCalled()
    expect(mocks.saveFile).not.toHaveBeenCalled()
  })

  it('rejects content that does not match an allowed declared type', async () => {
    const file = new File(['<html>not a pdf</html>'], 'source.pdf', { type: 'application/pdf' })

    const response = await POST(uploadRequest(file), context)

    expect(response.status).toBe(415)
    expect(mocks.saveFile).not.toHaveBeenCalled()
  })

  it('stores an owner upload using the verified MIME type', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })

    const response = await POST(uploadRequest(file), context)

    expect(response.status).toBe(201)
    expect(mocks.findFolder).toHaveBeenCalledWith({
      where: { id: 'folder-a', userId: 'user-a' },
    })
    expect(mocks.aggregateFiles).toHaveBeenCalledWith({
      where: { skillFolder: { userId: 'user-a' } },
      _count: { _all: true },
      _sum: { size: true },
    })
    expect(mocks.saveFile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: file.name,
        size: file.size,
        type: file.type,
      }),
      'folder-a',
      'application/pdf'
    )
    expect(mocks.createFile).toHaveBeenCalledWith({
      data: {
        filename: 'stored.pdf',
        originalName: 'source.pdf',
        mimeType: 'application/pdf',
        size: 12,
        skillFolderId: 'folder-a',
      },
    })
  })

  it('removes stored bytes when the metadata write fails', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })
    mocks.createFile.mockRejectedValue(new Error('database unavailable'))

    const response = await POST(uploadRequest(file), context)

    expect(response.status).toBe(500)
    expect(mocks.deleteFile).toHaveBeenCalledWith('/safe/stored.pdf')
  })

  it('stops before persistence when cancellation is observed after quota checks', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })
    const controller = new AbortController()
    mocks.aggregateFiles.mockImplementation(async () => {
      controller.abort()
      return {
        _count: { _all: 0 },
        _sum: { size: 0 },
      }
    })

    const response = await POST(uploadRequest(file, controller.signal), context)

    expect(response.status).toBe(499)
    expect(mocks.saveFile).not.toHaveBeenCalled()
    expect(mocks.createFile).not.toHaveBeenCalled()
  })

  it('removes stored bytes when cancellation is observed after the file write', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })
    const controller = new AbortController()
    mocks.saveFile.mockImplementation(async () => {
      controller.abort()
      return {
        filename: 'stored.pdf',
        originalName: 'source.pdf',
        mimeType: 'application/pdf',
        size: 12,
        path: '/safe/stored.pdf',
        hash: 'hash',
      }
    })

    const response = await POST(uploadRequest(file, controller.signal), context)

    expect(response.status).toBe(499)
    expect(mocks.deleteFile).toHaveBeenCalledWith('/safe/stored.pdf')
    expect(mocks.createFile).not.toHaveBeenCalled()
  })

  it('removes bytes and metadata when cancellation is observed after persistence', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })
    const controller = new AbortController()
    mocks.createFile.mockImplementation(async () => {
      controller.abort()
      return { id: 'file-a' }
    })

    const response = await POST(uploadRequest(file, controller.signal), context)

    expect(response.status).toBe(499)
    expect(mocks.deleteFile).toHaveBeenCalledWith('/safe/stored.pdf')
    expect(mocks.deleteFileRecord).toHaveBeenCalledWith({ where: { id: 'file-a' } })
    expect(mocks.deleteFile.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteFileRecord.mock.invocationCallOrder[0],
    )
  })

  it('retains cancellation metadata when stored-byte rollback fails', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })
    const controller = new AbortController()
    mocks.createFile.mockImplementation(async () => {
      controller.abort()
      return { id: 'file-a' }
    })
    mocks.deleteFile.mockRejectedValue(new Error('permission denied'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await POST(uploadRequest(file, controller.signal), context)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      code: 'UPLOAD_CANCELLATION_ROLLBACK_FAILED',
    })
    expect(mocks.deleteFileRecord).not.toHaveBeenCalled()
  })

  it('reports retained metadata when cancellation cleanup removes bytes only', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })
    const controller = new AbortController()
    mocks.createFile.mockImplementation(async () => {
      controller.abort()
      return { id: 'file-a' }
    })
    mocks.deleteFileRecord.mockRejectedValue(new Error('database unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await POST(uploadRequest(file, controller.signal), context)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      code: 'UPLOAD_METADATA_ROLLBACK_FAILED',
    })
    expect(mocks.deleteFile).toHaveBeenCalledWith('/safe/stored.pdf')
    expect(mocks.deleteFileRecord).toHaveBeenCalledWith({ where: { id: 'file-a' } })
  })

  it('rejects uploads when the per-user file count quota is reached', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })
    mocks.aggregateFiles.mockResolvedValue({
      _count: { _all: 2 },
      _sum: { size: 12 },
    })

    const response = await POST(uploadRequest(file), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'UPLOAD_FILE_COUNT_QUOTA_EXCEEDED',
      limit: 2,
    })
    expect(mocks.saveFile).not.toHaveBeenCalled()
  })

  it('rejects uploads that would exceed the per-user byte quota', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })
    mocks.aggregateFiles.mockResolvedValue({
      _count: { _all: 1 },
      _sum: { size: 10 },
    })

    const response = await POST(uploadRequest(file), context)

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({
      code: 'UPLOAD_TOTAL_BYTES_QUOTA_EXCEEDED',
      limit: 20,
    })
    expect(mocks.saveFile).not.toHaveBeenCalled()
  })

  it('maps a database-arbitrated duplicate race to the normal conflict response', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })
    mocks.createFile.mockRejectedValue({ code: 'P2002' })

    const response = await POST(uploadRequest(file), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'DUPLICATE_FILE_NAME',
    })
    expect(mocks.deleteFile).toHaveBeenCalledWith('/safe/stored.pdf')
  })

  it('surfaces a failed rollback without leaking the storage path to the client', async () => {
    const file = new File(['%PDF-1.7 test'], 'source.pdf', { type: 'application/pdf' })
    mocks.createFile.mockRejectedValue(new Error('database unavailable'))
    mocks.deleteFile.mockRejectedValue(new Error('permission denied at /safe/stored.pdf'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await POST(uploadRequest(file), context)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toMatchObject({ code: 'UPLOAD_ROLLBACK_FAILED' })
    expect(JSON.stringify(body)).not.toContain('/safe/stored.pdf')
  })
})
