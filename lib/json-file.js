/**
 * Small helpers for durable JSON files: ENOENT is an empty document, a parse
 * or read failure is a hard error (never silently treated as empty), writes are
 * atomic, and one module-level queue serializes read-modify-write cycles.
 */
import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Read JSON; missing file -> fallback, corrupt/unreadable -> throw. */
export async function readJsonFile(path, fallback) {
  let raw
  try {
    raw = await readFile(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw new Error(`读取数据文件失败：${path}（${error.message}）`)
  }
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`数据文件损坏，拒绝覆盖：${path}（${error.message}）`)
  }
}

/** Write JSON atomically with 0600 permissions. */
export async function writeJsonFile(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 })
  await rename(tmp, path)
  await chmod(path, 0o600).catch(() => {})
}

/** Serialize operations; a failed run does not poison later runs. */
export function createQueue() {
  let chain = Promise.resolve()
  return (operation) => {
    const run = chain.then(operation)
    chain = run.then(() => undefined, () => undefined)
    return run
  }
}

/** File size in bytes, 0 when absent. */
export async function fileBytes(path) {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}
