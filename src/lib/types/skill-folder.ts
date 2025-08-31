export interface SkillFolder {
  id: string
  name: string
  description?: string
  color?: string
  createdAt: Date
  updatedAt: Date
  userId: string
  _count?: {
    files: number
    notes: number
    qaPairs: number
  }
}

export interface CreateSkillFolderData {
  name: string
  description?: string
  color?: string
}

export interface UpdateSkillFolderData {
  name?: string
  description?: string
  color?: string
}

export interface SkillFolderWithContent extends SkillFolder {
  files: File[]
  notes: Note[]
  qaPairs: QAPair[]
}

export interface File {
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

export interface QAPair {
  id: string
  question: string
  answer: string
  difficulty?: string
  createdAt: Date
  skillFolderId: string
}