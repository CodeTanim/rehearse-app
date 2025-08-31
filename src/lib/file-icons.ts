// Client-safe file icon utilities (no Node.js dependencies)

export class FileIcons {
  static getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType === 'application/pdf') return '📄'
    if (mimeType.startsWith('text/')) return '📝'
    if (mimeType.includes('word')) return '📄'
    if (mimeType.includes('excel')) return '📊'
    if (mimeType.includes('powerpoint')) return '📽️'
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦'
    if (mimeType.includes('audio')) return '🎵'
    if (mimeType.includes('video')) return '🎬'
    return '📎'
  }

  static getFileIconColor(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '#10B981' // Green
    if (mimeType === 'application/pdf') return '#EF4444' // Red
    if (mimeType.startsWith('text/')) return '#8B5CF6' // Purple
    if (mimeType.includes('word')) return '#2563EB' // Blue
    if (mimeType.includes('excel')) return '#059669' // Green
    if (mimeType.includes('powerpoint')) return '#DC2626' // Red
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '#F59E0B' // Yellow
    return '#6B7280' // Gray
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