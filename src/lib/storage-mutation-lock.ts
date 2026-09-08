type StorageMutationLockState = {
  tail: Promise<void>
}

type StorageMutationGlobal = typeof globalThis & {
  __rehearseStorageMutationLock?: StorageMutationLockState
}

const storageGlobal = globalThis as StorageMutationGlobal
const lockState = storageGlobal.__rehearseStorageMutationLock ?? {
  tail: Promise.resolve(),
}

storageGlobal.__rehearseStorageMutationLock = lockState

/**
 * Serializes local filesystem/database mutations inside this Node.js process.
 * The current prototype is explicitly single-process; production must replace
 * this with durable reservations or database-backed locking.
 */
export async function withStorageMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = lockState.tail
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  lockState.tail = previous.catch(() => undefined).then(() => gate)
  await previous.catch(() => undefined)

  try {
    return await operation()
  } finally {
    release()
  }
}
