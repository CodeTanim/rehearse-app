// Server-only file storage implementation (with Node.js dependencies)
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { STORAGE_CONFIG as CLIENT_CONFIG, UploadedFile } from './file-utils'

// Server-side storage configuration
export const STORAGE_CONFIG = {
  ...CLIENT_CONFIG,
  uploadDir: path.join(process.cwd(), 'uploads'),
  thumbnailDir: path.join(process.cwd(), 'uploads', 'thumbnails'),
}

export class FileStorage {
  private static async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir)
    } catch {
      await fs.mkdir(dir, { recursive: true })
    }
  }

  private static generateSafeFilename(originalName: string): string {
    const ext = path.extname(originalName)
    const basename = path.basename(originalName, ext)
    const safeBasename = basename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const uniqueId = uuidv4().substring(0, 8)
    return `${uniqueId}_${safeBasename}${ext}`
  }

  private static async calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath)
    return crypto.createHash('sha256').update(fileBuffer).digest('hex')
  }

  static async saveFile(
    file: File,
    skillFolderId: string
  ): Promise<UploadedFile> {
    // Ensure upload directory exists
    const skillFolderDir = path.join(STORAGE_CONFIG.uploadDir, skillFolderId)
    await this.ensureDirectoryExists(skillFolderDir)

    // Generate safe filename
    const filename = this.generateSafeFilename(file.name)
    const filePath = path.join(skillFolderDir, filename)

    // Save file to disk
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // Calculate file hash
    const hash = await this.calculateFileHash(filePath)

    return {
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      path: filePath,
      hash,
    }
  }

  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      // File might not exist, log but don't throw
      console.warn('File deletion failed:', error)
    }
  }

  static async getFileStream(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath)
  }

  static getFilePath(skillFolderId: string, filename: string): string {
    return path.join(STORAGE_CONFIG.uploadDir, skillFolderId, filename)
  }
}