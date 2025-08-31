// Server-only thumbnail generation (with Node.js dependencies)
import fs from 'fs/promises'
import path from 'path'
import { STORAGE_CONFIG } from './file-storage-server'

export interface ThumbnailOptions {
  width?: number
  height?: number
  quality?: number
}

export class ThumbnailGenerator {
  private static readonly DEFAULT_SIZE = 200
  private static readonly DEFAULT_QUALITY = 80

  static async ensureThumbnailDir(): Promise<void> {
    try {
      await fs.access(STORAGE_CONFIG.thumbnailDir)
    } catch {
      await fs.mkdir(STORAGE_CONFIG.thumbnailDir, { recursive: true })
    }
  }

  static getThumbnailPath(fileId: string, extension: string = 'webp'): string {
    return path.join(STORAGE_CONFIG.thumbnailDir, `${fileId}.${extension}`)
  }

  static async generateImageThumbnail(
    inputPath: string,
    fileId: string,
    options: ThumbnailOptions = {}
  ): Promise<string | null> {
    // For now, we'll return null and implement actual image processing later
    // This would typically use Sharp or similar library for image processing
    // For the MVP, we'll rely on CSS scaling of images
    return null
  }

  static async generatePDFThumbnail(
    inputPath: string,
    fileId: string,
    options: ThumbnailOptions = {}
  ): Promise<string | null> {
    // For now, we'll return null and implement PDF thumbnail generation later
    // This would typically use PDF-lib or similar to render first page as image
    return null
  }

  static async generateTextThumbnail(
    inputPath: string,
    fileId: string,
    content: string,
    options: ThumbnailOptions = {}
  ): Promise<string | null> {
    // For now, we'll return null and implement text preview generation later
    // This could generate a preview image showing the first few lines of text
    return null
  }

  static async generateThumbnail(
    filePath: string,
    fileId: string,
    mimeType: string,
    options: ThumbnailOptions = {}
  ): Promise<string | null> {
    await this.ensureThumbnailDir()

    try {
      if (mimeType.startsWith('image/')) {
        return await this.generateImageThumbnail(filePath, fileId, options)
      } else if (mimeType === 'application/pdf') {
        return await this.generatePDFThumbnail(filePath, fileId, options)
      } else if (mimeType.startsWith('text/')) {
        const content = await fs.readFile(filePath, 'utf-8')
        return await this.generateTextThumbnail(filePath, fileId, content, options)
      }
    } catch (error) {
      console.error('Thumbnail generation failed:', error)
    }

    return null
  }

  static async cleanupThumbnails(fileIds: string[]): Promise<void> {
    try {
      const thumbnailFiles = await fs.readdir(STORAGE_CONFIG.thumbnailDir)
      
      for (const thumbnailFile of thumbnailFiles) {
        const fileId = path.basename(thumbnailFile, path.extname(thumbnailFile))
        
        if (!fileIds.includes(fileId)) {
          const thumbnailPath = path.join(STORAGE_CONFIG.thumbnailDir, thumbnailFile)
          await fs.unlink(thumbnailPath).catch(() => {
            // Ignore errors for missing files
          })
        }
      }
    } catch (error) {
      console.error('Thumbnail cleanup failed:', error)
    }
  }

  static async deleteThumbnail(fileId: string): Promise<void> {
    try {
      const thumbnailPath = this.getThumbnailPath(fileId)
      await fs.unlink(thumbnailPath)
    } catch {
      // Thumbnail might not exist, which is fine
    }
  }
}