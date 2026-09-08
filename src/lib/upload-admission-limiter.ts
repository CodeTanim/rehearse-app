export const LOCAL_UPLOAD_ADMISSION_LIMITS = {
  maxConcurrent: 2,
  maxQueued: 8,
} as const

export class UploadAdmissionQueueFullError extends Error {
  readonly code = 'UPLOAD_QUEUE_FULL'

  constructor() {
    super('The local upload queue is full')
    this.name = 'UploadAdmissionQueueFullError'
  }
}

export class UploadRequestCancelledError extends Error {
  readonly code = 'UPLOAD_CANCELLED'

  constructor() {
    super('Upload cancelled')
    this.name = 'UploadRequestCancelledError'
  }
}

type QueuedAdmission = {
  resolve: (release: () => void) => void
  reject: (error: UploadRequestCancelledError) => void
  signal?: AbortSignal
  handleAbort: () => void
}

export class UploadAdmissionLimiter {
  private active = 0
  private readonly queue: QueuedAdmission[] = []

  constructor(
    readonly maxConcurrent: number,
    readonly maxQueued: number,
  ) {
    if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new TypeError('Upload concurrency must be a positive integer')
    }
    if (!Number.isSafeInteger(maxQueued) || maxQueued < 0) {
      throw new TypeError('Upload queue size must be a non-negative integer')
    }
  }

  async run<T>(signal: AbortSignal | undefined, operation: () => Promise<T>): Promise<T> {
    const release = await this.acquire(signal)

    try {
      throwIfUploadCancelled(signal)
      return await operation()
    } finally {
      release()
    }
  }

  get snapshot() {
    return {
      active: this.active,
      queued: this.queue.length,
    }
  }

  private acquire(signal?: AbortSignal): Promise<() => void> {
    throwIfUploadCancelled(signal)

    if (this.active < this.maxConcurrent) {
      this.active += 1
      return Promise.resolve(this.createRelease())
    }

    if (this.queue.length >= this.maxQueued) {
      return Promise.reject(new UploadAdmissionQueueFullError())
    }

    return new Promise<() => void>((resolve, reject) => {
      const admission: QueuedAdmission = {
        resolve,
        reject,
        signal,
        handleAbort: () => {
          const queueIndex = this.queue.indexOf(admission)
          if (queueIndex === -1) return

          this.queue.splice(queueIndex, 1)
          this.removeAbortListener(admission)
          reject(new UploadRequestCancelledError())
        },
      }

      signal?.addEventListener('abort', admission.handleAbort, { once: true })
      this.queue.push(admission)

      // Close the small race between the initial check and listener setup.
      if (signal?.aborted) admission.handleAbort()
    })
  }

  private createRelease(): () => void {
    let released = false

    return () => {
      if (released) return
      released = true
      this.active = Math.max(0, this.active - 1)
      this.admitNext()
    }
  }

  private admitNext() {
    while (this.active < this.maxConcurrent) {
      const admission = this.queue.shift()
      if (!admission) return

      this.removeAbortListener(admission)
      if (admission.signal?.aborted) {
        admission.reject(new UploadRequestCancelledError())
        continue
      }

      this.active += 1
      admission.resolve(this.createRelease())
    }
  }

  private removeAbortListener(admission: QueuedAdmission) {
    admission.signal?.removeEventListener('abort', admission.handleAbort)
  }
}

type UploadAdmissionGlobal = typeof globalThis & {
  __rehearseUploadAdmissionLimiter?: UploadAdmissionLimiter
}

const uploadAdmissionGlobal = globalThis as UploadAdmissionGlobal

// This limiter is deliberately process-local for the documented single-process
// development prototype. Production needs shared admission and durable quotas.
const localUploadAdmissionLimiter =
  uploadAdmissionGlobal.__rehearseUploadAdmissionLimiter ??
  new UploadAdmissionLimiter(
    LOCAL_UPLOAD_ADMISSION_LIMITS.maxConcurrent,
    LOCAL_UPLOAD_ADMISSION_LIMITS.maxQueued,
  )

uploadAdmissionGlobal.__rehearseUploadAdmissionLimiter = localUploadAdmissionLimiter

export function throwIfUploadCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new UploadRequestCancelledError()
}

export function isUploadAdmissionQueueFullError(
  error: unknown,
): error is UploadAdmissionQueueFullError {
  return (
    error instanceof UploadAdmissionQueueFullError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'UPLOAD_QUEUE_FULL')
  )
}

export function isUploadRequestCancelledError(
  error: unknown,
): error is UploadRequestCancelledError {
  return (
    error instanceof UploadRequestCancelledError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'UPLOAD_CANCELLED')
  )
}

export function withLocalUploadAdmission<T>(
  signal: AbortSignal | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  return localUploadAdmissionLimiter.run(signal, operation)
}
