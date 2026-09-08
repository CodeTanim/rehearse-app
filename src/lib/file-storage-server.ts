// Server-only file storage implementation (with Node.js dependencies)
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import {
  STORAGE_CONFIG as CLIENT_CONFIG,
  type AllowedMimeType,
  type UploadedFile,
} from './file-utils'

// Server-side storage configuration
export const STORAGE_CONFIG = {
  ...CLIENT_CONFIG,
  uploadDir: path.join(process.cwd(), 'uploads'),
  thumbnailDir: path.join(process.cwd(), 'uploads', 'thumbnails'),
}

export const STORAGE_PERMISSIONS = {
  directory: 0o700,
  file: 0o600,
} as const

export const USER_UPLOAD_QUOTAS = {
  maxFileCount: 100,
  maxTotalBytes: 250 * 1024 * 1024,
} as const

export class FileStorage {
  private static resolveUploadPath(...segments: string[]): string {
    const uploadRoot = path.resolve(STORAGE_CONFIG.uploadDir)
    const resolvedPath = path.resolve(uploadRoot, ...segments)
    const relativePath = path.relative(uploadRoot, resolvedPath)

    if (
      relativePath === '..' ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      throw new Error('Invalid file storage path')
    }

    return resolvedPath
  }

  private static async ensureDirectoryExists(dir: string): Promise<void> {
    await fs.mkdir(dir, {
      recursive: true,
      mode: STORAGE_PERMISSIONS.directory,
    })

    const directory = await fs.lstat(dir)
    if (!directory.isDirectory() || directory.isSymbolicLink()) {
      throw new Error('File storage directory is not a private directory')
    }

    // mkdir's mode is affected by existing paths, so repair it every time.
    await fs.chmod(dir, STORAGE_PERMISSIONS.directory)
  }

  private static generateSafeFilename(originalName: string): string {
    const ext = path.extname(originalName)
    const basename = path.basename(originalName, ext)
    const safeBasename = basename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const uniqueId = randomUUID().substring(0, 8)
    return `${uniqueId}_${safeBasename}${ext}`
  }

  private static async calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath)
    return createHash('sha256').update(fileBuffer).digest('hex')
  }

  static async saveFile(
    file: File,
    skillFolderId: string,
    verifiedMimeType: AllowedMimeType,
  ): Promise<UploadedFile> {
    // Ensure both levels are private even when they predate this process.
    await this.ensureDirectoryExists(STORAGE_CONFIG.uploadDir)
    const skillFolderDir = this.resolveUploadPath(skillFolderId)
    await this.ensureDirectoryExists(skillFolderDir)

    // Generate safe filename
    const filename = this.generateSafeFilename(file.name)
    const filePath = path.join(skillFolderDir, filename)

    const buffer = Buffer.from(await file.arrayBuffer())
    let bytesWritten = false

    try {
      await fs.writeFile(filePath, buffer, {
        flag: 'wx',
        mode: STORAGE_PERMISSIONS.file,
      })
      bytesWritten = true
      await fs.chmod(filePath, STORAGE_PERMISSIONS.file)

      const hash = await this.calculateFileHash(filePath)

      return {
        filename,
        originalName: file.name,
        mimeType: verifiedMimeType,
        size: file.size,
        path: filePath,
        hash,
      }
    } catch (storageError) {
      if (bytesWritten) {
        try {
          await fs.unlink(filePath)
        } catch (cleanupError) {
          console.error('Incomplete upload cleanup left an orphaned storage object.', {
            skillFolderId,
            storedFilename: filename,
            error: cleanupError,
          })
          throw new AggregateError(
            [storageError, cleanupError],
            'File storage failed and its partial write could not be cleaned up'
          )
        }
      }

      throw storageError
    }
  }

  static async deleteFile(filePath: string): Promise<void> {
    const resolvedPath = this.resolveUploadPath(filePath)

    try {
      await fs.unlink(resolvedPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  static async deleteSkillFolderFiles(skillFolderId: string): Promise<void> {
    const folderPath = this.resolveUploadPath(skillFolderId)
    if (folderPath === path.resolve(STORAGE_CONFIG.uploadDir)) {
      throw new Error('Refusing to delete the upload root')
    }

    await fs.rm(folderPath, { recursive: true, force: true })
  }

  static async getFileStream(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath)
  }

  static getFilePath(skillFolderId: string, filename: string): string {
    return this.resolveUploadPath(skillFolderId, filename)
  }
}
