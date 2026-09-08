export const NOTE_TITLE_MAX_LENGTH = 200
export const NOTE_CONTENT_MAX_LENGTH = 50_000

export function getNoteTitleError(title: string): string | null {
  if (title.length > NOTE_TITLE_MAX_LENGTH) {
    return `Title must be ${NOTE_TITLE_MAX_LENGTH} characters or fewer.`
  }
  if (!title.trim()) return 'Title is required.'
  return null
}

export function getNoteContentError(content: string): string | null {
  if (content.length > NOTE_CONTENT_MAX_LENGTH) {
    return `Note content must be ${NOTE_CONTENT_MAX_LENGTH.toLocaleString('en-US')} characters or fewer.`
  }
  if (!content.trim()) return 'Note content is required.'
  return null
}
