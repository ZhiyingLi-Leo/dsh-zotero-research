/**
 * Durable store for the combined analysis the reader actually saw:
 * the main result plus every supplemental page-range result, keyed by
 * paper + mode + research focus.
 *
 * The host's `state.analyses` cache is keyed by a content hash and does not
 * record which focus produced an entry; this store records the focus and the
 * supplement list so a later panel mount can restore the exact combination
 * without calling the model again.
 *
 * @module dsh-zotero-research/analysis-store
 */
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import { createQueue, fileBytes, readJsonFile, writeJsonFile } from './json-file.js'
import { runExclusive } from './txn.js'
import { stateDir } from './store.js'

// Research results are never evicted: this file is not a cache. Only the
// rebuildable page-image cache under cache/ may be cleared.
const queue = createQueue()

function filePath() {
  return join(stateDir(), 'analyses.json')
}

async function readAll() {
  const parsed = await readJsonFile(filePath(), {})
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`组合分析数据格式无效：${filePath()}`)
  }
  return parsed
}

/** Stable id for one focus value (the focus text itself is stored too). */
function entryId(key, mode, focus) {
  const digest = createHash('sha1').update(String(focus ?? '')).digest('hex').slice(0, 10)
  return `${key}:${mode}:${digest}`
}

/** Persist one combined analysis. Serialized; write failures reject the caller. */
export function saveCombined({ key, mode, focus, analysis }) {
  return runExclusive(() => queue(async () => {
    const all = await readAll()
    const id = entryId(key, mode, focus)
    all[id] = { key, mode, focus: String(focus ?? ''), analysis, savedAt: Date.now() }
    await writeJsonFile(filePath(), all)
    return { id, count: Object.keys(all).length }
  }))
}

/** Storage summary for the UI; never evicts, only reports capacity. */
export async function analysisStats() {
  const all = await readAll()
  const count = Object.keys(all).length
  const bytes = await fileBytes(filePath())
  const warning = count > 500 || bytes > 20 * 1024 * 1024
    ? `组合分析已保存 ${count} 份 / ${(bytes / 1024 / 1024).toFixed(1)} MB；不会自动删除，建议导出备份。`
    : null
  return { count, bytes, warning }
}

/** Every saved combined analysis (backup/export). */
export async function listAllSaved() {
  const all = await readAll()
  return Object.values(all)
}

/** Every saved combined analysis for one paper. */
export async function listSaved(key) {
  const all = await readAll()
  return Object.values(all).filter((entry) => entry.key === key)
}
