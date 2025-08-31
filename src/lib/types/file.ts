export interface FileWithMetadata {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: Date
  skillFolderId: string
}

export interface CreateFileData {
  file: File
}

export interface FileUploadResponse {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: Date
  skillFolderId: string
}

export interface Note {
  id: string
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
  skillFolderId: string
}

export interface CreateNoteData {
  title: string
  content: string
}

export interface UpdateNoteData {
  title?: string
  content?: string
}

export interface FileCategory {
  type: 'image' | 'document' | 'text' | 'archive' | 'unknown'
  icon: string
  color: string
}

export const FILE_CATEGORIES: Record<string, FileCategory> = {
  image: {
    type: 'image',
    icon: '🖼️',
    color: '#10B981'
  },
  document: {
    type: 'document', 
    icon: '📄',
    color: '#3B82F6'
  },
  text: {
    type: 'text',
    icon: '📝',
    color: '#8B5CF6'
  },
  archive: {
    type: 'archive',
    icon: '📦',
    color: '#F59E0B'
  },
  unknown: {
    type: 'unknown',
    icon: '📎',
    color: '#6B7280'
  }
}

export const SUPPORTED_FILE_TYPES = [
  // Images
  { extension: '.jpg', mimeType: 'image/jpeg', category: 'image' },
  { extension: '.jpeg', mimeType: 'image/jpeg', category: 'image' },
  { extension: '.png', mimeType: 'image/png', category: 'image' },
  { extension: '.gif', mimeType: 'image/gif', category: 'image' },
  { extension: '.webp', mimeType: 'image/webp', category: 'image' },
  { extension: '.svg', mimeType: 'image/svg+xml', category: 'image' },
  
  // Documents
  { extension: '.pdf', mimeType: 'application/pdf', category: 'document' },
  { extension: '.doc', mimeType: 'application/msword', category: 'document' },
  { extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'document' },
  { extension: '.xls', mimeType: 'application/vnd.ms-excel', category: 'document' },
  { extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'document' },
  { extension: '.ppt', mimeType: 'application/vnd.ms-powerpoint', category: 'document' },
  { extension: '.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', category: 'document' },
  
  // Text
  { extension: '.txt', mimeType: 'text/plain', category: 'text' },
  { extension: '.md', mimeType: 'text/markdown', category: 'text' },
  { extension: '.csv', mimeType: 'text/csv', category: 'text' },
  { extension: '.json', mimeType: 'application/json', category: 'text' },
  { extension: '.js', mimeType: 'text/javascript', category: 'text' },
  { extension: '.css', mimeType: 'text/css', category: 'text' },
  { extension: '.html', mimeType: 'text/html', category: 'text' },
  
  // Archives
  { extension: '.zip', mimeType: 'application/zip', category: 'archive' },
  { extension: '.rar', mimeType: 'application/x-rar-compressed', category: 'archive' },
] as const