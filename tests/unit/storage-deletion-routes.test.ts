import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findFolder: vi.fn(),
  deleteFolder: vi.fn(),
  findFile: vi.fn(),
  deleteFileRecord: vi.fn(),
  deleteSkillFolderFiles: vi.fn(),
  getFilePath: vi.fn(),
  deleteStoredFile: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    skillFolder: {
      findFirst: mocks.findFolder,
      delete: mocks.deleteFolder,
    },
    file: {
      findFirst: mocks.findFile,
      delete: mocks.deleteFileRecord,
    },
  },
}))
vi.mock('@/lib/file-storage-server', () => ({
  FileStorage: {
    deleteSkillFolderFiles: mocks.deleteSkillFolderFiles,
    getFilePath: mocks.getFilePath,
    deleteFile: mocks.deleteStoredFile,
  },
}))

import { DELETE as deleteFolder } from '@/app/api/skill-folders/[id]/route'
import { DELETE as deleteFile } from '@/app/api/skill-folders/[id]/files/[fileId]/route'

const folderRequest = new NextRequest('http://localhost/api/skill-folders/folder-a', {
  method: 'DELETE',
})
const folderContext = { params: Promise.resolve({ id: 'folder-a' }) }
const fileRequest = new NextRequest('http://localhost/api/skill-folders/folder-a/files/file-a', {
  method: 'DELETE',
})
const fileContext = { params: Promise.resolve({ id: 'folder-a', fileId: 'file-a' }) }

describe('storage-safe deletion routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-a' } })
    mocks.findFolder.mockResolvedValue({ id: 'folder-a', userId: 'user-a' })
    mocks.deleteFolder.mockResolvedValue({ id: 'folder-a' })
    mocks.findFile.mockResolvedValue({ id: 'file-a', filename: 'stored.pdf' })
    mocks.deleteFileRecord.mockResolvedValue({ id: 'file-a' })
    mocks.deleteSkillFolderFiles.mockResolvedValue(undefined)
    mocks.getFilePath.mockReturnValue('/safe/folder-a/stored.pdf')
    mocks.deleteStoredFile.mockResolvedValue(undefined)
  })

  it('removes folder bytes before deleting its metadata', async () => {
    const response = await deleteFolder(folderRequest, folderContext)

    expect(response.status).toBe(200)
    expect(mocks.deleteSkillFolderFiles).toHaveBeenCalledWith('folder-a')
    expect(mocks.deleteSkillFolderFiles.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteFolder.mock.invocationCallOrder[0]
    )
  })

  it('keeps folder metadata and returns an actionable error when storage deletion fails', async () => {
    mocks.deleteSkillFolderFiles.mockRejectedValue(new Error('permission denied'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await deleteFolder(folderRequest, folderContext)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      code: 'FOLDER_STORAGE_DELETE_FAILED',
    })
    expect(mocks.deleteFolder).not.toHaveBeenCalled()
  })

  it('does not touch storage when the folder is not owned or does not exist', async () => {
    mocks.findFolder.mockResolvedValue(null)

    const response = await deleteFolder(folderRequest, folderContext)

    expect(response.status).toBe(404)
    expect(mocks.deleteSkillFolderFiles).not.toHaveBeenCalled()
  })

  it('reports when folder bytes were removed but metadata deletion failed', async () => {
    mocks.deleteFolder.mockRejectedValue(new Error('database unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await deleteFolder(folderRequest, folderContext)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      code: 'FOLDER_METADATA_DELETE_FAILED',
    })
    expect(mocks.deleteSkillFolderFiles).toHaveBeenCalledWith('folder-a')
  })

  it('keeps file metadata and returns an actionable error when byte deletion fails', async () => {
    mocks.deleteStoredFile.mockRejectedValue(new Error('permission denied'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await deleteFile(fileRequest, fileContext)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      code: 'FILE_STORAGE_DELETE_FAILED',
    })
    expect(mocks.deleteFileRecord).not.toHaveBeenCalled()
  })

  it('removes individual file bytes before deleting metadata', async () => {
    const response = await deleteFile(fileRequest, fileContext)

    expect(response.status).toBe(200)
    expect(mocks.getFilePath).toHaveBeenCalledWith('folder-a', 'stored.pdf')
    expect(mocks.deleteStoredFile.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteFileRecord.mock.invocationCallOrder[0]
    )
  })

  it('does not touch storage when the file is not owned or does not exist', async () => {
    mocks.findFile.mockResolvedValue(null)

    const response = await deleteFile(fileRequest, fileContext)

    expect(response.status).toBe(404)
    expect(mocks.deleteStoredFile).not.toHaveBeenCalled()
  })

  it('reports when file bytes were removed but metadata deletion failed', async () => {
    mocks.deleteFileRecord.mockRejectedValue(new Error('database unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await deleteFile(fileRequest, fileContext)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      code: 'FILE_METADATA_DELETE_FAILED',
    })
    expect(mocks.deleteStoredFile).toHaveBeenCalledWith('/safe/folder-a/stored.pdf')
  })
})
