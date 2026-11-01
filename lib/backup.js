/**
 * Plugin-data backup and additive restore.
 *
 * Backup covers research questions (stances + understanding evolution),
 * combined analyses (main + supplements + synthesis), in-panel Q&A and the
 * reading queue. It never includes the Zotero write key, settings or cache.
 *
 * Validation is deep (fields, enums, primary keys, dangerous property names)
 * and runs before any write. Restore is additive and wrapped in a snapshot:
 * if any step fails, the four data files are rolled back to their pre-restore
 * contents instead of leaving a half-applied restore.
 */
import { copyFile, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import { listAllSaved, saveCombined } from './analysis-store.js'
import { readAllAsk, readResearch, saveAsk, saveResearch } from './records.js'
import { readState, stateDir, updateState } from './store.js'
import { runExclusive } from './txn.js'
import { VERSION } from './version.js'

// Stable data format kept for existing backups; not the plugin identity.
export const BACKUP_FORMAT = 'dsh-zotero-backup'
export const BACKUP_VERSION = 1

const PAPER_KEY = /^[A-Z0-9]{4,20}$/i
const MODES = ['quick', 'rough', 'deep']
const STATUSES = ['待验证', '认同', '存疑', '与实验相关']
const STANCES = ['支持', '反对', '限制', '待验证']
const QUEUE_STATUS = ['todo', 'reading', 'done']
const MAX_ENTRIES = 5000
const DANGEROUS = new Set(['__proto__', 'prototype', 'constructor'])

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isText = (value, max = 200000) => typeof value === 'string' && value.length <= max
const isSafeKey = (value, max = 200) => isText(value, max) && value.length > 0 && !DANGEROUS.has(value) && !/[\u0000-\u001f]/.test(value)
const percentage = (value) => typeof value === 'number' && Number.isFinite(value)

/** Reject dangerous property names anywhere in a parsed value. */
function dangerousPath(value, path = '') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = dangerousPath(value[index], `${path}[${index}]`)
      if (found !== null) return found
    }
    return null
  }
  if (!isObject(value)) return null
  for (const [key, child] of Object.entries(value)) {
    if (DANGEROUS.has(key)) return `${path}.${key}`
    const found = dangerousPath(child, `${path}.${key}`)
    if (found !== null) return found
  }
  return null
}

function validateEvidence(entry, path, errors) {
  if (!isObject(entry)) { errors.push(`${path} 必须是对象`); return }
  if (!isText(entry.quote, 20000) || entry.quote.trim() === '') errors.push(`${path}.quote 必须是非空字符串`)
  if (entry.page !== undefined && entry.page !== null && !(percentage(entry.page) && entry.page >= 1)) errors.push(`${path}.page 必须是 >=1 的数字`)
  if (entry.why !== undefined && !isText(entry.why, 20000)) errors.push(`${path}.why 必须是字符串`)
  if (entry.paperKey !== undefined && !PAPER_KEY.test(String(entry.paperKey))) errors.push(`${path}.paperKey 无效`)
  if (entry.stance !== undefined && !STANCES.includes(entry.stance)) errors.push(`${path}.stance 必须是 ${STANCES.join('/')}`)
}

const SECTION_FIELDS = [
  'question', 'contribution', 'relevance', 'priority', 'reason',
  'oneLine', 'background', 'method', 'results', 'figures', 'limitations', 'connection', 'questions',
  'logic', 'methodDetail', 'equations', 'evidenceQuality', 'confounders', 'authorLimitations',
  'critique', 'reproduction', 'insights', 'openQuestions', 'basis',
]

function validateCoverage(coverage, path, errors) {
  if (coverage === undefined || coverage === null) return
  if (!isObject(coverage)) { errors.push(`${path} 必须是对象`); return }
  if (coverage.pagesTotal !== undefined && !(percentage(coverage.pagesTotal) && coverage.pagesTotal >= 0)) errors.push(`${path}.pagesTotal 必须是数字`)
  if (coverage.pdfPageCount !== undefined && coverage.pdfPageCount !== null && !(percentage(coverage.pdfPageCount) && coverage.pdfPageCount >= 0)) errors.push(`${path}.pdfPageCount 必须是数字或 null`)
  for (const field of ['readFrom', 'readTo']) {
    if (coverage[field] !== undefined && coverage[field] !== null && !(percentage(coverage[field]) && coverage[field] >= 1)) errors.push(`${path}.${field} 必须是 >=1 的数字或 null`)
  }
  for (const field of ['partialPage', 'truncated']) {
    if (coverage[field] !== undefined && typeof coverage[field] !== 'boolean') errors.push(`${path}.${field} 必须是布尔值`)
  }
  if (coverage.missing !== undefined) {
    if (!Array.isArray(coverage.missing)) errors.push(`${path}.missing 必须是数组`)
    else coverage.missing.forEach((pair, index) => {
      if (!Array.isArray(pair) || pair.length !== 2 || !percentage(pair[0]) || !percentage(pair[1]) || pair[0] < 1 || pair[1] < pair[0]) {
        errors.push(`${path}.missing[${index}] 必须是 [起页, 止页]`)
      }
    })
  }
}

/** Fields the reader renders as a text/array section; a plain object there is a bug. */
const TEXT_FIELDS = new Set([
  'question', 'contribution', 'relevance', 'priority', 'reason',
  'oneLine', 'background', 'method', 'results', 'limitations', 'connection',
  'logic', 'methodDetail', 'evidenceQuality', 'confounders', 'authorLimitations', 'critique',
])

/** Recursively accept only JSON-safe values (objects are rendered as JSON text). */
function validateJsonish(value, path, errors, depth = 0) {
  if (depth > 20) { errors.push(`${path} 嵌套过深`); return }
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return
  if (Array.isArray(value)) {
    if (value.length > MAX_ENTRIES) { errors.push(`${path} 数组过大`); return }
    value.forEach((entry, index) => validateJsonish(entry, `${path}[${index}]`, errors, depth + 1))
    return
  }
  if (isObject(value)) {
    const keys = Object.keys(value)
    if (keys.length > 200) { errors.push(`${path} 字段过多`); return }
    for (const [key, child] of Object.entries(value)) {
      if (DANGEROUS.has(key)) { errors.push(`${path}.${key} 是危险属性名`); continue }
      validateJsonish(child, `${path}.${key}`, errors, depth + 1)
    }
    return
  }
  errors.push(`${path} 不是 JSON 值`)
}

function validateParsed(parsed, path, errors, mode = 'quick') {
  if (parsed === undefined || parsed === null) return
  if (!isObject(parsed)) { errors.push(`${path} 必须是对象`); return }
  for (const field of SECTION_FIELDS) {
    if (parsed[field] === undefined || parsed[field] === null) continue
    // Deep-mode reproduction is a legitimate structured object (see prompts.js).
    if (field === 'reproduction') {
      if (!isObject(parsed[field]) && !Array.isArray(parsed[field])) errors.push(`${path}.${field} 必须是对象或数组`)
      else validateJsonish(parsed[field], `${path}.${field}`, errors)
      continue
    }
    if (TEXT_FIELDS.has(field) && isObject(parsed[field]) && !Array.isArray(parsed[field])) {
      errors.push(`${path}.${field} 不能是对象（应为文本或数组）`)
    }
  }
  if (parsed.basis !== undefined && !isText(parsed.basis, 20000)) errors.push(`${path}.basis 必须是字符串`)
  if (parsed.readDeeper !== undefined && typeof parsed.readDeeper !== 'boolean') errors.push(`${path}.readDeeper 必须是布尔值`)
  if (parsed.evidence !== undefined && parsed.evidence !== null) {
    if (!Array.isArray(parsed.evidence)) errors.push(`${path}.evidence 必须是数组`)
    else parsed.evidence.forEach((entry, index) => validateEvidence(entry, `${path}.evidence[${index}]`, errors))
  }
}

function validateAnalysis(entry, path, errors) {
  if (!isObject(entry)) { errors.push(`${path} 必须是对象`); return }
  if (!PAPER_KEY.test(String(entry.key ?? ''))) errors.push(`${path}.key 不是 Zotero 文献 key`)
  if (!MODES.includes(entry.mode)) errors.push(`${path}.mode 必须是 quick/rough/deep`)
  if (!isText(entry.focus, 1000)) errors.push(`${path}.focus 必须是字符串`)
  if (!isObject(entry.analysis)) errors.push(`${path}.analysis 必须是对象`)
  if (entry.id !== undefined && !isText(entry.id, 200)) errors.push(`${path}.id 必须是字符串`)
  if (entry.savedAt !== undefined && !percentage(entry.savedAt)) errors.push(`${path}.savedAt 必须是数字`)
  if (entry.analysis !== undefined) validateAnalysisPayload(entry.analysis, `${path}.analysis`, errors)
}

function validateAnalysisPayload(analysis, path, errors) {
  if (!isObject(analysis)) { errors.push(`${path} 必须是对象`); return }
  if (analysis.key !== undefined && !PAPER_KEY.test(String(analysis.key))) errors.push(`${path}.key 无效`)
  if (analysis.mode !== undefined && !MODES.includes(analysis.mode)) errors.push(`${path}.mode 必须是 quick/rough/deep`)
  if (analysis.basis !== undefined && !isText(analysis.basis, 20000)) errors.push(`${path}.basis 必须是字符串`)
  if (analysis.generatedAt !== undefined && !percentage(analysis.generatedAt)) errors.push(`${path}.generatedAt 必须是数字`)
  if (analysis.partial !== undefined && typeof analysis.partial !== 'boolean') errors.push(`${path}.partial 必须是布尔值`)
  if (analysis.range !== undefined && analysis.range !== null) {
    if (!Array.isArray(analysis.range) || analysis.range.length !== 2 || !percentage(analysis.range[0]) || !percentage(analysis.range[1])) errors.push(`${path}.range 必须是 [起页, 止页]`)
  }
  validateCoverage(analysis.coverage, `${path}.coverage`, errors)
  validateParsed(analysis.parsed, `${path}.parsed`, errors, analysis.mode)
  if (analysis.evidence !== undefined && analysis.evidence !== null) {
    if (!Array.isArray(analysis.evidence)) errors.push(`${path}.evidence 必须是数组`)
    else analysis.evidence.forEach((entry, index) => validateEvidence(entry, `${path}.evidence[${index}]`, errors))
  }
  if (analysis.supplements !== undefined && analysis.supplements !== null) {
    if (!Array.isArray(analysis.supplements)) errors.push(`${path}.supplements 必须是数组`)
    else analysis.supplements.forEach((supplement, index) => {
      const at = `${path}.supplements[${index}]`
      if (!isObject(supplement)) { errors.push(`${at} 必须是对象`); return }
      if (supplement.basis !== undefined && !isText(supplement.basis, 20000)) errors.push(`${at}.basis 必须是字符串`)
      validateCoverage(supplement.coverage, `${at}.coverage`, errors)
      validateParsed(supplement.parsed, `${at}.parsed`, errors, supplement.mode ?? analysis.mode)
      if (supplement.evidence !== undefined && supplement.evidence !== null) {
        if (!Array.isArray(supplement.evidence)) errors.push(`${at}.evidence 必须是数组`)
        else supplement.evidence.forEach((entry, evidenceIndex) => validateEvidence(entry, `${at}.evidence[${evidenceIndex}]`, errors))
      }
    })
  }
  if (analysis.synthesis !== undefined && analysis.synthesis !== null) {
    const synth = analysis.synthesis
    const at = `${path}.synthesis`
    if (!isObject(synth)) { errors.push(`${at} 必须是对象`); return }
    for (const field of ['question', 'methods', 'conditions', 'results', 'limitations', 'relevance', 'coverageNote']) {
      if (synth[field] !== undefined && synth[field] !== null && !(typeof synth[field] === 'string' || typeof synth[field] === 'number')) {
        errors.push(`${at}.${field} 必须是字符串或数字`)
      }
    }
    if (synth.conflicts !== undefined && synth.conflicts !== null) {
      if (!Array.isArray(synth.conflicts)) errors.push(`${at}.conflicts 必须是数组`)
      else synth.conflicts.forEach((conflict, index) => {
        const cpath = `${at}.conflicts[${index}]`
        if (!isObject(conflict)) { errors.push(`${cpath} 必须是对象`); return }
        for (const field of ['topic', 'batches', 'resolution', 'status']) {
          if (conflict[field] !== undefined && !isText(conflict[field], 20000)) errors.push(`${cpath}.${field} 必须是字符串`)
        }
      })
    }
    if (synth.uncertainties !== undefined && synth.uncertainties !== null) {
      if (!Array.isArray(synth.uncertainties)) errors.push(`${at}.uncertainties 必须是数组`)
      else if (synth.uncertainties.some((item) => !(typeof item === 'string' || typeof item === 'number'))) errors.push(`${at}.uncertainties 只能包含字符串或数字`)
    }
    if (synth.evidence !== undefined && synth.evidence !== null) {
      if (!Array.isArray(synth.evidence)) errors.push(`${at}.evidence 必须是数组`)
      else synth.evidence.forEach((entry, index) => validateEvidence(entry, `${at}.evidence[${index}]`, errors))
    }
    validateCoverage(synth.coverage, `${at}.coverage`, errors)
  }
}

function validateQuestion(question, path, errors) {
  if (!isObject(question)) { errors.push(`${path} 必须是对象`); return }
  if (!isSafeKey(question.id)) errors.push(`${path}.id 必须是安全的非空字符串`)
  if (!isText(question.title, 1000) || question.title.trim() === '') errors.push(`${path}.title 必须是非空字符串`)
  if (!STATUSES.includes(question.status)) errors.push(`${path}.status 必须是 ${STATUSES.join('/')}`)
  if (question.understanding !== undefined && !isText(question.understanding, 200000)) errors.push(`${path}.understanding 必须是字符串`)
  for (const field of ['openQuestions', 'nextActions']) {
    if (question[field] === undefined) continue
    if (!Array.isArray(question[field]) || question[field].length > 1000) { errors.push(`${path}.${field} 必须是数组`); continue }
    if (question[field].some((item) => !isText(item, 10000) || item.trim() === '')) errors.push(`${path}.${field} 只能包含非空字符串`)
  }
  if (question.updatedAt !== undefined && !percentage(question.updatedAt)) errors.push(`${path}.updatedAt 必须是数字`)
  if (question.evolution !== undefined) {
    if (!Array.isArray(question.evolution) || question.evolution.length > MAX_ENTRIES) errors.push(`${path}.evolution 必须是数组`)
    else question.evolution.forEach((entry, index) => {
      if (!isObject(entry)) { errors.push(`${path}.evolution[${index}] 必须是对象`); return }
      if (!percentage(entry.at)) errors.push(`${path}.evolution[${index}].at 必须是数字`)
      if (entry.summary !== undefined && !isText(entry.summary, 50000)) errors.push(`${path}.evolution[${index}].summary 必须是字符串`)
      if (entry.materials !== undefined && !percentage(entry.materials)) errors.push(`${path}.evolution[${index}].materials 必须是数字`)
    })
  }
  const materials = question.materials
  if (!isObject(materials)) { errors.push(`${path}.materials 必须是对象`); return }
  if (materials.papers !== undefined) {
    if (!Array.isArray(materials.papers) || materials.papers.length > MAX_ENTRIES) errors.push(`${path}.materials.papers 必须是数组`)
    else if (materials.papers.some((key) => !PAPER_KEY.test(String(key)))) errors.push(`${path}.materials.papers 含无效文献 key`)
  }
  if (materials.evidence !== undefined) {
    if (!Array.isArray(materials.evidence) || materials.evidence.length > MAX_ENTRIES) errors.push(`${path}.materials.evidence 必须是数组`)
    else materials.evidence.forEach((entry, index) => validateEvidence(entry, `${path}.materials.evidence[${index}]`, errors))
  }
  if (materials.conversations !== undefined) {
    if (!Array.isArray(materials.conversations) || materials.conversations.length > MAX_ENTRIES) errors.push(`${path}.materials.conversations 必须是数组`)
    else materials.conversations.forEach((entry, index) => {
      if (!isObject(entry)) { errors.push(`${path}.materials.conversations[${index}] 必须是对象`); return }
      if (entry.sessionId !== undefined && !/^session-[A-Za-z0-9-]{6,80}$/.test(String(entry.sessionId))) errors.push(`${path}.materials.conversations[${index}].sessionId 无效`)
      if (entry.title !== undefined && !isText(entry.title, 1000)) errors.push(`${path}.materials.conversations[${index}].title 必须是字符串`)
      if (entry.stance !== undefined && !STANCES.includes(entry.stance)) errors.push(`${path}.materials.conversations[${index}].stance 必须是 ${STANCES.join('/')}`)
    })
  }
}

function validateAsk(ask, errors) {
  if (!isObject(ask)) { errors.push('data.ask 必须是对象'); return }
  for (const [key, scopes] of Object.entries(ask)) {
    if (!PAPER_KEY.test(key)) { errors.push(`data.ask 含无效文献 key：${key}`); continue }
    if (!isObject(scopes)) { errors.push(`data.ask.${key} 必须是 scope 对象`); continue }
    for (const [scope, record] of Object.entries(scopes)) {
      if (!isSafeKey(scope) || !(scope === 'paper' || scope.startsWith('focus:'))) { errors.push(`data.ask.${key}.${scope} 不是合法 scope`); continue }
      if (!isObject(record)) { errors.push(`data.ask.${key}.${scope} 必须是对象`); continue }
      if (!Array.isArray(record.turns) || record.turns.length > MAX_ENTRIES) { errors.push(`data.ask.${key}.${scope}.turns 必须是数组`); continue }
      record.turns.forEach((turn, index) => {
        if (!isObject(turn)) { errors.push(`data.ask.${key}.${scope}.turns[${index}] 必须是对象`); return }
        if (turn.role !== 'user' && turn.role !== 'assistant') errors.push(`data.ask.${key}.${scope}.turns[${index}].role 必须是 user/assistant`)
        if (!isText(turn.content, 200000)) errors.push(`data.ask.${key}.${scope}.turns[${index}].content 必须是字符串`)
        if (turn.excerpt !== undefined && typeof turn.excerpt !== 'boolean') errors.push(`data.ask.${key}.${scope}.turns[${index}].excerpt 必须是布尔值`)
      })
    }
  }
}

/** Deep validation; no I/O and never mutates the backup. */
export function validateBackup(backup) {
  const errors = []
  if (!isObject(backup)) return { ok: false, errors: ['备份不是 JSON 对象'] }
  const danger = dangerousPath(backup)
  if (danger !== null) return { ok: false, errors: [`包含危险属性名：${danger}`] }
  if (backup.format !== BACKUP_FORMAT) errors.push('不是 dsh-zotero-research（兼容 dsh-zotero）备份文件')
  if (backup.version !== BACKUP_VERSION) errors.push(`不支持的备份版本：${String(backup.version)}`)
  if (backup.appVersion !== undefined && !isText(backup.appVersion, 100)) errors.push('appVersion 无效')
  if (backup.exportedAt !== undefined && !isText(backup.exportedAt, 100)) errors.push('exportedAt 无效')
  const data = backup.data
  if (!isObject(data)) {
    errors.push('缺少 data 对象')
    return { ok: false, errors }
  }
  if (data.queue !== undefined) {
    if (!isObject(data.queue)) errors.push('data.queue 必须是对象')
    else for (const [key, entry] of Object.entries(data.queue)) {
      if (!PAPER_KEY.test(key)) { errors.push(`data.queue 含无效文献 key：${key}`); continue }
      if (!isObject(entry)) { errors.push(`data.queue.${key} 必须是对象`); continue }
      if (!QUEUE_STATUS.includes(entry.status)) errors.push(`data.queue.${key}.status 必须是 todo/reading/done`)
      if (!percentage(entry.priority)) errors.push(`data.queue.${key}.priority 必须是数字`)
      if (entry.note !== undefined && !isText(entry.note, 10000)) errors.push(`data.queue.${key}.note 必须是字符串`)
      if (entry.updatedAt !== undefined && !percentage(entry.updatedAt)) errors.push(`data.queue.${key}.updatedAt 必须是数字`)
    }
  }
  if (data.analyses !== undefined) {
    if (!Array.isArray(data.analyses)) errors.push('data.analyses 必须是数组')
    else if (data.analyses.length > MAX_ENTRIES) errors.push(`data.analyses 超过 ${MAX_ENTRIES} 条`)
    else data.analyses.forEach((entry, index) => validateAnalysis(entry, `data.analyses[${index}]`, errors))
  }
  if (data.research !== undefined) {
    if (!Array.isArray(data.research)) errors.push('data.research 必须是数组')
    else if (data.research.length > MAX_ENTRIES) errors.push(`data.research 超过 ${MAX_ENTRIES} 条`)
    else {
      const seen = new Set()
      data.research.forEach((entry, index) => {
        validateQuestion(entry, `data.research[${index}]`, errors)
        if (isObject(entry) && typeof entry.id === 'string') {
          if (seen.has(entry.id)) errors.push(`data.research 有重复 id：${entry.id}`)
          seen.add(entry.id)
        }
      })
    }
  }
  validateAsk(data.ask ?? {}, errors)
  return { ok: errors.length === 0, errors }
}

/** Compute the store's analysis primary key; entry.id is never trusted. */
export function analysisPrimaryKey({ key, mode, focus }) {
  const digest = createHash('sha1').update(String(focus ?? '')).digest('hex').slice(0, 10)
  return `${key}:${mode}:${digest}`
}

/** Build a sanitized backup object. */
export async function buildBackup() {
  const state = await readState()
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      queue: state.queue ?? {},
      analyses: await listAllSaved(),
      ask: await readAllAsk(),
      research: await readResearch(),
    },
  }
}

/** Read-only preview; validates deeply first and computes conflicts by primary key. */
export async function previewRestore(backup) {
  const validation = validateBackup(backup)
  if (validation.ok !== true) throw new Error(validation.errors.join('；'))
  const state = await readState()
  const analyses = await listAllSaved()
  const ask = await readAllAsk()
  const research = await readResearch()
  const data = backup.data ?? {}
  const queueKeys = Object.keys(data.queue ?? {})
  const analysisKeys = (data.analyses ?? []).map(analysisPrimaryKey)
  const askKeys = Object.entries(data.ask ?? {}).flatMap(([key, scopes]) => Object.keys(scopes ?? {}).map((scope) => `${key}::${scope}`))
  const researchIds = (data.research ?? []).map((entry) => entry.id)
  const conflict = {
    queue: queueKeys.filter((key) => state.queue?.[key] !== undefined),
    analyses: analysisKeys.filter((id) => analyses.some((entry) => entry.id === id || analysisPrimaryKey(entry) === id)),
    ask: askKeys.filter((compound) => {
      const [key, scope] = compound.split('::')
      return ask[key]?.[scope] !== undefined
    }),
    research: researchIds.filter((id) => research.some((entry) => entry.id === id)),
  }
  let askNewTurns = 0
  let askExistingScopes = 0
  let askTurns = 0
  for (const [key, scopes] of Object.entries(data.ask ?? {})) {
    for (const [scope, record] of Object.entries(scopes ?? {})) {
      const turns = record.turns ?? []
      askTurns += turns.length
      const current = ask[key]?.[scope]?.turns
      if (current !== undefined) askExistingScopes += 1
      askNewTurns += turns.filter((turn) => !(current ?? []).some((existing) => existing.role === turn.role && existing.content === turn.content)).length
    }
  }
  return {
    counts: { queue: queueKeys.length, analyses: (data.analyses ?? []).length, ask: askKeys.length, research: researchIds.length },
    ask: { scopes: askKeys.length, turns: askTurns, newTurns: askNewTurns, existingScopes: askExistingScopes },
    conflicts: conflict,
    skipped: conflict.queue.length + conflict.analyses.length + conflict.research.length,
  }
}

const FILES = ['state.json', 'analyses.json', 'ask.json', 'research.json']

async function snapshot() {
  const dir = join(stateDir(), `.restore-${process.pid}-${Date.now()}`)
  await mkdir(dir, { recursive: true })
  const saved = new Set()
  for (const name of FILES) {
    try {
      await copyFile(join(stateDir(), name), join(dir, name))
      saved.add(name)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  return { dir, saved }
}

async function rollback(snap) {
  for (const name of FILES) {
    const target = join(stateDir(), name)
    if (snap.saved.has(name)) {
      const tmp = `${target}.${process.pid}.rollback.tmp`
      await copyFile(join(snap.dir, name), tmp)
      await rename(tmp, target)
    } else {
      await rm(target, { force: true })
    }
  }
}

async function dropSnapshot(snap) {
  await rm(snap.dir, { recursive: true, force: true })
}

/** Fail before any write when the state directory is not writable. */
async function probeWritable() {
  await mkdir(stateDir(), { recursive: true })
  const probe = join(stateDir(), `.restore-probe-${process.pid}`)
  await writeFile(probe, 'ok', { mode: 0o600 })
  await rm(probe, { force: true })
}

/** Unfinished restore snapshots left by an interrupted process. */
export async function listRestoreSnapshots() {
  try {
    return (await readdir(stateDir())).filter((name) => name.startsWith('.restore-'))
  } catch {
    return []
  }
}

/** Apply a validated backup additively with snapshot rollback. */
export function restoreBackup(backup) {
  return runExclusive(() => restoreBackupLocked(backup))
}

async function restoreBackupLocked(backup) {
  const validation = validateBackup(backup)
  if (validation.ok !== true) throw new Error(validation.errors.join('；'))
  const preview = await previewRestore(backup)
  const data = backup.data ?? {}
  await probeWritable()

  // Primary key is computed from key+mode+focus; entry.id is display-only.
  const existingAnalyses = new Set((await listAllSaved()).map((entry) => analysisPrimaryKey(entry)))
  const existingResearch = new Set((await readResearch()).map((entry) => entry.id))
  const existingAsk = await readAllAsk()
  const existingQueue = (await readState()).queue ?? {}

  const plan = {
    queue: Object.entries(data.queue ?? {}).filter(([key]) => existingQueue[key] === undefined),
    analyses: (data.analyses ?? []).filter((entry) => !existingAnalyses.has(analysisPrimaryKey(entry))),
    research: (data.research ?? []).filter((entry) => !existingResearch.has(entry.id)),
    ask: [],
  }
  for (const [key, scopes] of Object.entries(data.ask ?? {})) {
    for (const [scope, record] of Object.entries(scopes ?? {})) {
      const current = existingAsk[key]?.[scope]?.turns ?? []
      const appended = (record.turns ?? []).filter((turn) => !current.some((existing) => existing.role === turn.role && existing.content === turn.content))
      if (appended.length > 0) plan.ask.push({ key, scope, turns: [...current, ...appended], appended: appended.length })
    }
  }

  const snap = await snapshot()
  let added = 0
  let merged = 0
  try {
    if (plan.queue.length > 0) {
      await updateState((state) => {
        state.queue = state.queue ?? {}
        for (const [key, entry] of plan.queue) {
          if (state.queue[key] !== undefined) continue
          state.queue[key] = entry
          added += 1
        }
        return state
      })
    }
    for (const entry of plan.analyses) {
      await saveCombined({ key: entry.key, mode: entry.mode, focus: entry.focus, analysis: entry.analysis })
      added += 1
    }
    for (const item of plan.ask) {
      await saveAsk(item.key, item.scope, item.turns)
      merged += item.appended
    }
    for (const question of plan.research) {
      await saveResearch(question)
      added += 1
    }
    await dropSnapshot(snap)
    return { added, merged, skipped: preview.skipped, preview }
  } catch (error) {
    let rollbackError = null
    try {
      await rollback(snap)
      await dropSnapshot(snap)
    } catch (caught) {
      rollbackError = caught
      /* keep the snapshot for manual recovery */
    }
    if (rollbackError !== null) {
      throw new Error(`恢复失败，且回滚失败；快照保留在 ${snap.dir}（${rollbackError.message}）。原数据可能处于部分恢复状态，请先导出备份并人工核对。原始错误：${error.message}`)
    }
    throw new Error(`恢复失败，已回滚到恢复前状态：${error.message}`)
  }
}
