// Client-safe file utilities (no Node.js dependencies)

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

const EXTENSIONS_BY_MIME_TYPE: Record<AllowedMimeType, readonly string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md', '.markdown'],
}

const BINARY_MIME_TYPES = new Set<AllowedMimeType>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
])

// File storage configuration that can be used on the client.
export const STORAGE_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  maxFileNameLength: 255,
  allowedMimeTypes: ALLOWED_MIME_TYPES,
}

export interface UploadedFile {
  filename: string
  originalName: string
  mimeType: string
  size: number
  path: string
  hash: string
}

export type FileValidationCode =
  | 'empty_file'
  | 'file_too_large'
  | 'invalid_filename'
  | 'unsupported_type'
  | 'extension_mismatch'
  | 'content_mismatch'

export type FileValidationResult =
  | { isValid: true; mimeType: AllowedMimeType }
  | { isValid: false; code: FileValidationCode; error: string }

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

function hasExpectedBinarySignature(bytes: Uint8Array, mimeType: AllowedMimeType): boolean {
  switch (mimeType) {
    case 'application/pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]) // %PDF-
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff])
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/gif':
      return (
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      )
    case 'image/webp':
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
      )
    default:
      return false
  }
}

function isUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return true
  } catch {
    return false
  }
}

export class FileUtils {
  static isValidMimeType(mimeType: string): mimeType is AllowedMimeType {
    return ALLOWED_MIME_TYPES.some((allowedType) => allowedType === mimeType)
  }

  static isValidFileSize(size: number): boolean {
    return Number.isSafeInteger(size) && size > 0 && size <= STORAGE_CONFIG.maxFileSize
  }

  static getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.')
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex).toLowerCase() : ''
  }

  static getMimeTypeCategory(mimeType: string): 'image' | 'document' | 'text' | 'archive' | 'unknown' {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType === 'application/pdf') return 'document'
    if (mimeType === 'text/plain' || mimeType === 'text/markdown') return 'text'
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive'
    return 'unknown'
  }

  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  static validateFile(file: Pick<File, 'name' | 'size' | 'type'>): FileValidationResult {
    if (!this.isValidFileSize(file.size)) {
      if (file.size === 0) {
        return { isValid: false, code: 'empty_file', error: 'File cannot be empty' }
      }

      return {
        isValid: false,
        code: 'file_too_large',
        error: `File size must be no more than ${this.formatFileSize(STORAGE_CONFIG.maxFileSize)}`,
      }
    }

    if (!file.name || file.name.length > STORAGE_CONFIG.maxFileNameLength || /[\r\n\0]/.test(file.name)) {
      return { isValid: false, code: 'invalid_filename', error: 'File name is invalid' }
    }

    if (!this.isValidMimeType(file.type)) {
      return {
        isValid: false,
        code: 'unsupported_type',
        error: `File type "${file.type || 'unknown'}" is not supported`,
      }
    }

    const extension = this.getFileExtension(file.name)
    if (!EXTENSIONS_BY_MIME_TYPE[file.type].includes(extension)) {
      return {
        isValid: false,
        code: 'extension_mismatch',
        error: 'File extension does not match its declared type',
      }
    }

    return { isValid: true, mimeType: file.type }
  }

  static async validateFileContent(file: File): Promise<FileValidationResult> {
    const metadataResult = this.validateFile(file)
    if (!metadataResult.isValid) return metadataResult

    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength !== file.size) {
      return {
        isValid: false,
        code: 'content_mismatch',
        error: 'File content size does not match its metadata',
      }
    }

    const contentMatches = BINARY_MIME_TYPES.has(metadataResult.mimeType)
      ? hasExpectedBinarySignature(bytes, metadataResult.mimeType)
      : isUtf8Text(bytes)

    if (!contentMatches) {
      return {
        isValid: false,
        code: 'content_mismatch',
        error: 'File contents do not match the supported file type',
      }
    }

    return metadataResult
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
