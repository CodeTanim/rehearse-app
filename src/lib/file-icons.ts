// Client-safe file icon utilities (no Node.js dependencies)

export class FileIcons {
  static getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'IMG'
    if (mimeType === 'application/pdf') return 'PDF'
    if (mimeType.startsWith('text/')) return 'TXT'
    if (mimeType.includes('word')) return 'DOC'
    if (mimeType.includes('excel')) return 'XLS'
    if (mimeType.includes('powerpoint')) return 'PPT'
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'ZIP'
    if (mimeType.includes('audio')) return 'AUD'
    if (mimeType.includes('video')) return 'VID'
    return 'FILE'
  }
}

// File preview utility functions
export const FilePreview = {
  canPreview: (mimeType: string): boolean => {
    return (
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/') ||
      mimeType === 'application/json'
    )
  },

  getPreviewType: (mimeType: string): 'image' | 'pdf' | 'text' | 'unsupported' => {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType === 'application/pdf') return 'pdf'
    if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text'
    return 'unsupported'
  },

  getMaxPreviewSize: (mimeType: string): number => {
    // Return max file size in bytes that can be previewed
    if (mimeType.startsWith('image/')) return 10 * 1024 * 1024 // 10MB
    if (mimeType === 'application/pdf') return 20 * 1024 * 1024 // 20MB
    if (mimeType.startsWith('text/')) return 1 * 1024 * 1024 // 1MB
    return 0
  },

  shouldShowPreview: (mimeType: string, fileSize: number): boolean => {
    if (!FilePreview.canPreview(mimeType)) return false
    
    const maxSize = FilePreview.getMaxPreviewSize(mimeType)
    return fileSize <= maxSize
  }
}
