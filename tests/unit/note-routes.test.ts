import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getNoteContentError,
  getNoteTitleError,
  NOTE_CONTENT_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
} from '@/lib/note-constraints'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findFolder: vi.fn(),
  findNote: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    skillFolder: { findFirst: mocks.findFolder },
    note: {
      findFirst: mocks.findNote,
      create: mocks.createNote,
      update: mocks.updateNote,
    },
  },
}))

import { POST as createNote } from '@/app/api/skill-folders/[id]/notes/route'
import { PATCH as updateNote } from '@/app/api/skill-folders/[id]/notes/[noteId]/route'

const folderContext = { params: Promise.resolve({ id: 'folder-a' }) }
const noteContext = { params: Promise.resolve({ id: 'folder-a', noteId: 'note-a' }) }

function jsonRequest(path: string, method: 'POST' | 'PATCH', body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('note validation contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-a' } })
    mocks.findFolder.mockResolvedValue({ id: 'folder-a', userId: 'user-a' })
    mocks.createNote.mockImplementation(async ({ data }) => ({ id: 'note-a', ...data }))
    mocks.updateNote.mockImplementation(async ({ data }) => ({ id: 'note-a', ...data }))
  })

  it('shares clear client constraints for required content and bounded fields', () => {
    expect(getNoteTitleError('   ')).toBe('Title is required.')
    expect(getNoteContentError('\n\t')).toBe('Note content is required.')
    expect(getNoteTitleError('a'.repeat(NOTE_TITLE_MAX_LENGTH + 1))).toContain('200')
    expect(getNoteContentError('a'.repeat(NOTE_CONTENT_MAX_LENGTH + 1))).toContain('50,000')
    expect(getNoteTitleError('a'.repeat(NOTE_TITLE_MAX_LENGTH))).toBeNull()
    expect(getNoteContentError('a'.repeat(NOTE_CONTENT_MAX_LENGTH))).toBeNull()
    expect(getNoteTitleError('Retrieval practice')).toBeNull()
    expect(getNoteContentError('Explain the idea in my own words.')).toBeNull()
  })

  it('rejects whitespace-only content when creating a note', async () => {
    const response = await createNote(
      jsonRequest('/api/skill-folders/folder-a/notes', 'POST', {
        title: 'A useful title',
        content: '  \n ',
      }),
      folderContext,
    )

    expect(response.status).toBe(400)
    expect(mocks.createNote).not.toHaveBeenCalled()
  })

  it('trims valid note fields before persistence', async () => {
    mocks.findNote.mockResolvedValue(null)

    const response = await createNote(
      jsonRequest('/api/skill-folders/folder-a/notes', 'POST', {
        title: '  Retrieval practice  ',
        content: '  Explain the idea without looking.  ',
      }),
      folderContext,
    )

    expect(response.status).toBe(201)
    expect(mocks.createNote).toHaveBeenCalledWith({
      data: {
        title: 'Retrieval practice',
        content: 'Explain the idea without looking.',
        skillFolderId: 'folder-a',
      },
    })
  })

  it('accepts and preserves exact maximum lengths', async () => {
    mocks.findNote.mockResolvedValue(null)
    const title = 't'.repeat(NOTE_TITLE_MAX_LENGTH)
    const content = 'c'.repeat(NOTE_CONTENT_MAX_LENGTH)

    const response = await createNote(
      jsonRequest('/api/skill-folders/folder-a/notes', 'POST', { title, content }),
      folderContext,
    )

    expect(response.status).toBe(201)
    expect(mocks.createNote).toHaveBeenCalledWith({
      data: { title, content, skillFolderId: 'folder-a' },
    })
  })

  it.each([
    ['title', { title: 'a'.repeat(NOTE_TITLE_MAX_LENGTH + 1), content: 'Valid content' }],
    ['content', { title: 'Valid title', content: 'a'.repeat(NOTE_CONTENT_MAX_LENGTH + 1) }],
  ])('rejects an oversized %s when creating a note', async (_field, body) => {
    const response = await createNote(
      jsonRequest('/api/skill-folders/folder-a/notes', 'POST', body),
      folderContext,
    )

    expect(response.status).toBe(400)
    expect(mocks.createNote).not.toHaveBeenCalled()
  })

  it.each([
    ['blank content', { content: '   ' }],
    ['oversized content', { content: 'a'.repeat(NOTE_CONTENT_MAX_LENGTH + 1) }],
    ['oversized title', { title: 'a'.repeat(NOTE_TITLE_MAX_LENGTH + 1) }],
    ['empty update', {}],
  ])('rejects an invalid patch with %s', async (_case, body) => {
    mocks.findNote.mockResolvedValue({
      id: 'note-a',
      title: 'Existing title',
      content: 'Existing content',
      skillFolderId: 'folder-a',
    })

    const response = await updateNote(
      jsonRequest('/api/skill-folders/folder-a/notes/note-a', 'PATCH', body),
      noteContext,
    )

    expect(response.status).toBe(400)
    expect(mocks.updateNote).not.toHaveBeenCalled()
  })

  it('trims a valid patch before persistence', async () => {
    mocks.findNote.mockResolvedValue({
      id: 'note-a',
      title: 'Existing title',
      content: 'Existing content',
      skillFolderId: 'folder-a',
    })
    mocks.updateNote.mockResolvedValue({
      id: 'note-a',
      title: 'Existing title',
      content: 'Updated content',
    })

    const response = await updateNote(
      jsonRequest('/api/skill-folders/folder-a/notes/note-a', 'PATCH', {
        content: '  Updated content  ',
      }),
      noteContext,
    )

    expect(response.status).toBe(200)
    expect(mocks.updateNote).toHaveBeenCalledWith({
      where: { id: 'note-a' },
      data: { content: 'Updated content' },
    })
  })

  it.each([
    ['create', createNote, '/api/skill-folders/folder-a/notes', folderContext],
    ['update', updateNote, '/api/skill-folders/folder-a/notes/note-a', noteContext],
  ] as const)('rejects malformed JSON for %s', async (_name, handler, path, context) => {
    mocks.findNote.mockResolvedValue({
      id: 'note-a',
      title: 'Existing title',
      content: 'Existing content',
      skillFolderId: 'folder-a',
    })
    const request = new NextRequest(`http://localhost${path}`, {
      method: path.endsWith('/notes') ? 'POST' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    })

    const response = await handler(request, context as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Request body must be valid JSON' })
  })
})
