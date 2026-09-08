import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { FileStorage, STORAGE_PERMISSIONS } from '@/lib/file-storage-server'

const createdFolderIds: string[] = []

afterEach(async () => {
  await Promise.all(
    createdFolderIds.splice(0).map((folderId) =>
      fs.rm(FileStorage.getFilePath(folderId, ''), { recursive: true, force: true })
    )
  )
})

describe('FileStorage path resolution', () => {
  it('keeps resolved files inside the upload root', () => {
    const result = FileStorage.getFilePath('folder-id', 'stored.pdf')
    expect(result).toBe(path.join(process.cwd(), 'uploads', 'folder-id', 'stored.pdf'))
  })

  it('rejects traversal and absolute storage paths', () => {
    expect(() => FileStorage.getFilePath('../outside', 'stored.pdf')).toThrow('Invalid file storage path')
    expect(() => FileStorage.getFilePath('folder-id', '../../../outside')).toThrow('Invalid file storage path')
    expect(() => FileStorage.getFilePath('/tmp', 'outside')).toThrow('Invalid file storage path')
  })

  it('creates private upload directories and files', async () => {
    const folderId = `storage-mode-test-${randomUUID()}`
    createdFolderIds.push(folderId)

    const stored = await FileStorage.saveFile(
      new File(['private notes'], 'notes.txt', { type: 'text/plain' }),
      folderId,
      'text/plain'
    )

    const [rootStats, folderStats, fileStats] = await Promise.all([
      fs.stat(path.join(process.cwd(), 'uploads')),
      fs.stat(FileStorage.getFilePath(folderId, '')),
      fs.stat(stored.path),
    ])

    expect(rootStats.mode & 0o777).toBe(STORAGE_PERMISSIONS.directory)
    expect(folderStats.mode & 0o777).toBe(STORAGE_PERMISSIONS.directory)
    expect(fileStats.mode & 0o777).toBe(STORAGE_PERMISSIONS.file)
  })

  it('treats missing bytes as already deleted but propagates real deletion failures', async () => {
    const folderId = `storage-delete-test-${randomUUID()}`
    createdFolderIds.push(folderId)
    const missingPath = FileStorage.getFilePath(folderId, 'missing.txt')

    await expect(FileStorage.deleteFile(missingPath)).resolves.toBeUndefined()

    await fs.mkdir(FileStorage.getFilePath(folderId, ''), { recursive: true })
    await expect(FileStorage.deleteFile(FileStorage.getFilePath(folderId, ''))).rejects.toMatchObject({
      code: expect.stringMatching(/^(EISDIR|EPERM)$/),
    })
  })

  it('deletes a folder storage subtree and refuses to target the upload root', async () => {
    const folderId = `storage-folder-delete-test-${randomUUID()}`
    createdFolderIds.push(folderId)
    await FileStorage.saveFile(
      new File(['private notes'], 'notes.txt', { type: 'text/plain' }),
      folderId,
      'text/plain'
    )

    await FileStorage.deleteSkillFolderFiles(folderId)

    await expect(fs.stat(FileStorage.getFilePath(folderId, ''))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(FileStorage.deleteSkillFolderFiles('')).rejects.toThrow(
      'Refusing to delete the upload root'
    )
  })
})
