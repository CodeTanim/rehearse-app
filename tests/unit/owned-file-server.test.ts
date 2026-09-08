import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    file: {
      findFirst: mocks.findFirst,
    },
  },
}))

import { findOwnedFile } from '@/lib/owned-file-server'

describe('findOwnedFile', () => {
  beforeEach(() => {
    mocks.findFirst.mockReset()
  })

  it('scopes the file lookup through the owning user and selects no folder data', async () => {
    mocks.findFirst.mockResolvedValue(null)

    await findOwnedFile('user-a', 'file-a')

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-a',
        skillFolder: {
          userId: 'user-a',
        },
      },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        size: true,
        skillFolderId: true,
      },
    })
  })
})
