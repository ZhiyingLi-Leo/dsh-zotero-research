/**
 * Process-wide serialization for plugin-data writes. Normal saves and a
 * backup restore share one lock so a restore snapshot/rollback can never
 * erase a record written while it was running. Re-entrant inside the lock.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

const storage = new AsyncLocalStorage()
let chain = Promise.resolve()

export function inTransaction() {
  return storage.getStore() === true
}

export function runExclusive(operation) {
  if (inTransaction()) return operation()
  const run = chain.then(() => storage.run(true, operation))
  chain = run.then(() => undefined, () => undefined)
  return run
}
