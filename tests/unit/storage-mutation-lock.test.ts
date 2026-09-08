import { describe, expect, it } from 'vitest'

import { withStorageMutationLock } from '@/lib/storage-mutation-lock'

describe('local storage mutation lock', () => {
  it('serializes mutations and releases the next operation after completion', async () => {
    const order: string[] = []
    let releaseFirst: () => void = () => {}
    let markFirstStarted: () => void = () => {}
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve
    })
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = withStorageMutationLock(async () => {
      order.push('first:start')
      markFirstStarted()
      await holdFirst
      order.push('first:end')
    })
    await firstStarted

    const second = withStorageMutationLock(async () => {
      order.push('second:start')
      order.push('second:end')
    })
    await Promise.resolve()
    expect(order).toEqual(['first:start'])

    releaseFirst()
    await Promise.all([first, second])
    expect(order).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
  })

  it('releases the queue when an operation fails', async () => {
    await expect(
      withStorageMutationLock(async () => {
        throw new Error('expected failure')
      }),
    ).rejects.toThrow('expected failure')

    await expect(withStorageMutationLock(async () => 'next')).resolves.toBe('next')
  })
})
