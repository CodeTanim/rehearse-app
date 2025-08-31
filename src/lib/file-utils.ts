// Client-safe file utilities (no Node.js dependencies)

// File storage configuration that can be used on client
export const STORAGE_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text files
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'text/javascript',
    'text/css',
    'text/html',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
  ],
}

export interface UploadedFile {
  filename: string
  originalName: string
  mimeType: string
  size: number
  path: string
  hash: string
}

export class FileUtils {
  static isValidMimeType(mimeType: string): boolean {
    return STORAGE_CONFIG.allowedMimeTypes.includes(mimeType)
  }

  static isValidFileSize(size: number): boolean {
    return size <= STORAGE_CONFIG.maxFileSize
  }

  static getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.')
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex).toLowerCase() : ''
  }

  static getMimeTypeCategory(mimeType: string): 'image' | 'document' | 'text' | 'archive' | 'unknown' {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('excel') || mimeType.includes('powerpoint')) return 'document'
    if (mimeType.startsWith('text/') || mimeType.includes('json')) return 'text'
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive'
    return 'unknown'
  }

  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  static validateFile(file: File): { isValid: boolean; error?: string } {
    if (!this.isValidFileSize(file.size)) {
      return {
        isValid: false,
        error: `File size must be less than ${this.formatFileSize(STORAGE_CONFIG.maxFileSize)}`
      }
    }

    if (!this.isValidMimeType(file.type)) {
      return {
        isValid: false,
        error: `File type "${file.type}" is not supported`
      }
    }

    return { isValid: true }
  }

  static generateSafeFileName(originalName: string): string {
    const extension = this.getFileExtension(originalName)
    const basename = originalName.substring(0, originalName.length - extension.length)
    const safeBasename = basename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    return `${timestamp}_${randomId}_${safeBasename}${extension}`
  }
}