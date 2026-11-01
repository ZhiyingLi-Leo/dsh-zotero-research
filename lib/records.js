/**
 * Small durable records for plugin-owned data: in-panel Q&A and the research
 * question workspace. Stored beside the plugin state, written atomically.
 */
import { join } from 'node:path'

import { createQueue, readJsonFile, writeJsonFile } from './json-file.js'
import { runExclusive } from './txn.js'
import { stateDir } from './store.js'

const queues = new Map()
const queueFor = (name) => {
  if (!queues.has(name)) queues.set(name, createQueue())
  return queues.get(name)
}

function pathOf(name) {
  return join(stateDir(), `${name}.json`)
}

async function readAll(name) {
  const parsed = await readJsonFile(pathOf(name), {})
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`数据文件格式无效：${pathOf(name)}`)
  }
  return parsed
}

function update(name, mutator) {
  return runExclusive(() => queueFor(name)(async () => {
    const all = await readAll(name)
    const changed = await mutator(all)
    await writeJsonFile(pathOf(name), changed === undefined ? all : changed)
  }))
}

/** Every Q&A scope (backup/export). */
export async function readAllAsk() {
  return readAll('ask')
}

/** Q&A turns for one paper and scope. */
export async function readAsk(key, scope) {
  const all = await readAll('ask')
  return all[key]?.[scope]?.turns ?? []
}

export function saveAsk(key, scope, turns) {
  return update('ask', (all) => {
    all[key] = all[key] ?? {}
    all[key][scope] = { turns, updatedAt: Date.now() }
    return all
  })
}

/** Every research question. */
export async function readResearch() {
  const all = await readAll('research')
  return Array.isArray(all.questions) ? all.questions : []
}

/** Insert or replace one research question by id. */
export function saveResearch(question) {
  return update('research', (all) => {
    const questions = Array.isArray(all.questions) ? all.questions : []
    const index = questions.findIndex((entry) => entry.id === question.id)
    if (index >= 0) questions[index] = question
    else questions.unshift(question)
    all.questions = questions
    return all
  })
}
