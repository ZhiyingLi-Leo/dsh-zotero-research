/**
 * Persistent plugin state: the Zotero write key, reading queue, analysis cache,
 * note bookkeeping and page-image cache.
 *
 * Lives under $DSH_HOME/storages/zotero-plugin. Writes are atomic and the state
 * file is mode 0600 because it can hold the Zotero local API key.
 *
 * @module dsh-zotero/store
 */
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { createQueue, readJsonFile, writeJsonFile } from './json-file.js'
import { runExclusive } from './txn.js'

const EMPTY = {
  apiKey: undefined,
  apiKeyRemembered: false,
  authorizedAt: undefined,
  queue: {},
  analyses: {},
  notes: {},
  themes: {},
  relations: {},
  settings: {},
}

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

export function stateDir() {
  return join(dshHome(), 'storages', 'zotero-plugin')
}

export function cacheDir() {
  return join(stateDir(), 'cache')
}

const stateQueue = createQueue()

function statePath() {
  return join(stateDir(), 'state.json')
}

/** Read state; a missing file is empty, a corrupt file is an error. */
export async function readState() {
  const parsed = await readJsonFile(statePath(), {})
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`状态文件格式无效：${statePath()}`)
  }
  return { ...EMPTY, ...parsed }
}

/**
 * Serialized read-modify-write of state.json. Concurrent callers cannot clobber
 * each other; a failed write rejects its caller but does not poison later runs.
 */
export function updateState(mutate) {
  return runExclusive(() => stateQueue(async () => {
    const state = await readState()
    const next = (await mutate(state)) ?? state
    await writeJsonFile(statePath(), next)
    return next
  }))
}

/** Key for one cached analysis. */
export function analysisKey(itemKey, mode, hash) {
  return `${itemKey}:${mode}:${hash}`
}

/** Cache one analysis result. */
export async function saveAnalysis(itemKey, mode, hash, payload) {
  await updateState((state) => {
    state.analyses = state.analyses ?? {}
    state.analyses[analysisKey(itemKey, mode, hash)] = { ...payload, savedAt: Date.now() }
    return state
  })
}

/** Read a cached analysis. */
export async function readAnalysis(itemKey, mode, hash) {
  const state = await readState()
  return state.analyses?.[analysisKey(itemKey, mode, hash)]
}

/** Page-image cache path for one attachment page. */
export function pageCachePath(attachmentKey, page, scale, rectsKey) {
  const suffix = rectsKey ? `-${rectsKey}` : ''
  return join(cacheDir(), 'pages', attachmentKey, `${page}-${scale}${suffix}.png`)
}

/** Ensure a directory exists. */
export async function ensureDir(path) {
  await mkdir(dirname(path), { recursive: true })
  return path
}
