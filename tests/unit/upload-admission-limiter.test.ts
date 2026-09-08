import { describe, expect, it, vi } from 'vitest'

import {
  UploadAdmissionLimiter,
  UploadAdmissionQueueFullError,
  UploadRequestCancelledError,
} from '@/lib/upload-admission-limiter'

function deferred() {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('local upload admission limiter', () => {
  it('bounds active work and admits queued uploads in order', async () => {
    const limiter = new UploadAdmissionLimiter(1, 2)
    const firstHold = deferred()
    const firstStarted = deferred()
    const order: string[] = []

    const first = limiter.run(undefined, async () => {
      order.push('first:start')
      firstStarted.resolve()
      await firstHold.promise
      order.push('first:end')
    })
    await firstStarted.promise

    const second = limiter.run(undefined, async () => {
      order.push('second')
    })

    expect(limiter.snapshot).toEqual({ active: 1, queued: 1 })
    expect(order).toEqual(['first:start'])

    firstHold.resolve()
    await Promise.all([first, second])

    expect(order).toEqual(['first:start', 'first:end', 'second'])
    expect(limiter.snapshot).toEqual({ active: 0, queued: 0 })
  })

  it('rejects excess work when its bounded queue is full', async () => {
    const limiter = new UploadAdmissionLimiter(1, 1)
    const firstHold = deferred()
    const firstStarted = deferred()

    const first = limiter.run(undefined, async () => {
      firstStarted.resolve()
      await firstHold.promise
    })
    await firstStarted.promise

    const second = limiter.run(undefined, async () => 'second')
    await expect(limiter.run(undefined, async () => 'third')).rejects.toBeInstanceOf(
      UploadAdmissionQueueFullError,
    )

    firstHold.resolve()
    await expect(first).resolves.toBeUndefined()
    await expect(second).resolves.toBe('second')
  })

  it('removes an aborted waiter without running its operation', async () => {
    const limiter = new UploadAdmissionLimiter(1, 1)
    const firstHold = deferred()
    const firstStarted = deferred()
    const queuedOperation = vi.fn(async () => undefined)
    const controller = new AbortController()

    const first = limiter.run(undefined, async () => {
      firstStarted.resolve()
      await firstHold.promise
    })
    await firstStarted.promise

    const queued = limiter.run(controller.signal, queuedOperation)
    expect(limiter.snapshot).toEqual({ active: 1, queued: 1 })

    controller.abort()
    await expect(queued).rejects.toBeInstanceOf(UploadRequestCancelledError)
    expect(queuedOperation).not.toHaveBeenCalled()
    expect(limiter.snapshot).toEqual({ active: 1, queued: 0 })

    firstHold.resolve()
    await first
    expect(limiter.snapshot).toEqual({ active: 0, queued: 0 })
  })

  it('does not admit an upload whose signal is already aborted', async () => {
    const limiter = new UploadAdmissionLimiter(1, 1)
    const operation = vi.fn(async () => undefined)
    const controller = new AbortController()
    controller.abort()

    await expect(limiter.run(controller.signal, operation)).rejects.toBeInstanceOf(
      UploadRequestCancelledError,
    )
    expect(operation).not.toHaveBeenCalled()
    expect(limiter.snapshot).toEqual({ active: 0, queued: 0 })
  })
})
