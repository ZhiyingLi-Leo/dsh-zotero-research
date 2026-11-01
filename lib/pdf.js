/**
 * PDF evidence tooling: page rendering and quote location through the compiled
 * PDFKit helper, plus Zotero's own indexed fulltext split into pages.
 *
 * The helper is compiled on first use with the local Swift toolchain and kept
 * beside the package, so no Python/poppler install is required.
 *
 * @module dsh-zotero/pdf
 */
import { spawn } from 'node:child_process'
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { pdfjsInfo, pdfjsLocate } from './pdfjs.js'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

/** Absolute path of the compiled helper. */
export function helperPath() {
  return join(packageRoot, 'build', 'pdfkit-helper')
}

/**
 * Describe the compiled helper without invoking it: availability, built arch,
 * minimum macOS and whether the current host can execute it.
 */
export async function helperCapability() {
  const binary = helperPath()
  const base = { path: binary, hostArch: process.arch, platform: process.platform, textBackend: 'pdfjs' }
  if (process.platform !== 'darwin') {
    return { ...base, available: false, compatible: false, error: '非 macOS 平台没有 PDFKit helper；使用跨平台文字后端（无图像预览）' }
  }
  try {
    await access(binary)
  } catch {
    return { ...base, available: false, error: 'PDFKit helper 未构建（缺少 build/pdfkit-helper）' }
  }
  let meta = {}
  try {
    meta = JSON.parse(await readFile(join(packageRoot, 'build', 'pdfkit-helper.json'), 'utf8'))
  } catch {
    /* older packages have no metadata */
  }
  const helperArch = typeof meta.arch === 'string' ? meta.arch : 'unknown'
  return {
    ...base,
    available: true,
    helperArch,
    minMacOS: typeof meta.minMacOS === 'string' ? meta.minMacOS : 'unknown',
    compatible: helperArch === 'unknown' ? true : helperArch === process.arch,
  }
}

/** Compile the helper when missing. */
export async function ensureHelper() {
  if (process.platform !== 'darwin') {
    throw Object.assign(new Error('当前平台没有可用的 PDF 图像渲染后端；文字与 Zotero 跳转仍可用'), { code: 'PDF_RENDER_UNAVAILABLE' })
  }
  const binary = helperPath()
  try {
    await access(binary)
    return binary
  } catch {
    // fall through to compile
  }
  const source = join(packageRoot, 'scripts', 'pdfkit-helper.swift')
  const cache = join(packageRoot, 'build', '.swift-module-cache')
  const target = process.arch === 'arm64' ? 'arm64-apple-macos13.0' : 'x86_64-apple-macos13.0'
  await mkdir(cache, { recursive: true })
  await mkdir(join(packageRoot, 'build'), { recursive: true })
  await new Promise((resolve, reject) => {
    const child = spawn('swiftc', ['-O', '-module-cache-path', cache, '-target', target, '-o', binary, source], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', (error) => reject(new Error(`swiftc 不可用：${error.message}（需要 Xcode Command Line Tools；也可先用 Zotero 索引文字预览）`)))
    child.on('exit', (code) => (code === 0
      ? resolve()
      : reject(new Error(`PDFKit helper 编译失败（需要 Xcode Command Line Tools）：${stderr.slice(-800)}`))))
  })
  await chmodExecutable(binary)
  try {
    await writeFile(join(packageRoot, 'build', 'pdfkit-helper.json'), JSON.stringify({
      arch: process.arch,
      minMacOS: '13.0',
      builtWith: 'local Swift toolchain',
      builtAt: new Date().toISOString(),
    }))
  } catch {
    /* metadata is advisory */
  }
  return binary
}

async function chmodExecutable(path) {
  const { chmod } = await import('node:fs/promises')
  await chmod(path, 0o755)
}

/** Run the helper with arguments and parse JSON output. */
async function runJson(args) {
  const binary = await ensureHelper()
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `pdfkit-helper exited ${code}`))
      try {
        resolve(JSON.parse(stdout))
      } catch (error) {
        reject(new Error(`pdfkit-helper returned invalid JSON: ${error.message}`))
      }
    })
  })
}

/** Page count and media-box sizes (PDFKit on macOS, PDF.js elsewhere). */
export async function pdfInfo(pdfPath) {
  try {
    return await runJson(['info', pdfPath])
  } catch {
    return pdfjsInfo(pdfPath)
  }
}

/** Render one page to PNG, optionally with Zotero-style highlight rects. */
export async function renderPage({ pdfPath, page, scale = 1.5, outPath, rects = [] }) {
  await mkdir(dirname(outPath), { recursive: true })
  const binary = await ensureHelper()
  const args = ['render', pdfPath, String(page), String(scale), outPath]
  if (rects.length > 0) args.push(JSON.stringify(rects))
  await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `render exited ${code}`))))
  })
  return outPath
}

/** Render a rectangular page region at high resolution, with highlight rects. */
export async function renderRegion({ pdfPath, page, scale = 2.2, outPath, rects = [], region }) {
  await mkdir(dirname(outPath), { recursive: true })
  const binary = await ensureHelper()
  const args = [
    'region', pdfPath, String(page), String(scale), outPath,
    String(region.x), String(region.y), String(region.w), String(region.h),
  ]
  if (rects.length > 0) args.push(JSON.stringify(rects))
  await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `region exited ${code}`))))
  })
  return outPath
}

/** Search a quote, returning [{page, label, rects, text}]. */
export async function searchQuote(pdfPath, quote, page) {
  // Canonical coordinate source: PDF.js returns PDF-space rects plus preview
  // rects. PDFKit is rendering-only; it never supplies annotation coordinates.
  const located = await pdfjsLocate(pdfPath, quote, page)
  // A page-only fallback has no coordinate source; let locateQuote emit that
  // page-level result with coordinateSpace "none" instead of labeling it "pdf".
  return { results: located === undefined || located.rects.length === 0 ? [] : [located] }
}

/**
 * Locate a quote robustly: exact first, then a de-hyphenated / whitespace-
 * collapsed window. Returns undefined when the PDF genuinely does not contain
 * it, so callers can show "unverified" instead of a fake highlight.
 */
export async function locateQuote(pdfPath, quote, pageHint) {
  const clean = String(quote ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length < 4) return undefined
  const words = clean.split(' ')
  const exact = await searchQuote(pdfPath, clean, pageHint)
  if (exact.results?.length > 0) {
    const best = exact.results[0]
    if (best.rects.length > 1 || words.length <= 12) {
      return {
        ...best,
        coordinateSpace: 'pdf',
        previewRects: best.previewRects ?? [],
        writable: best.writable === true,
      }
    }
  }
  if (words.length >= 8) {
    const chunkSize = 6
    const hits = []
    for (let index = 0; index + 3 <= words.length; index += chunkSize) {
      const chunk = words.slice(index, index + chunkSize).join(' ')
      if (chunk.length < 12) continue
      const found = await searchQuote(pdfPath, chunk, pageHint)
      if (found.results?.length > 0) hits.push({ index, ...found.results[0] })
    }
    if (hits.length > 0) {
      const byPage = new Map()
      for (const hit of hits) {
        const list = byPage.get(hit.page) ?? []
        list.push(hit)
        byPage.set(hit.page, list)
      }
      const [page, list] = [...byPage.entries()].sort((a, b) => b[1].length - a[1].length)[0]
      const ordered = list.sort((a, b) => a.index - b.index)
      const merge = (field) => {
        const seen = new Set()
        const rects = []
        for (const hit of ordered) {
          for (const rect of hit[field] ?? []) {
            const key = rect.map((value) => Math.round(value * 10) / 10).join(',')
            if (seen.has(key)) continue
            seen.add(key)
            rects.push(rect)
          }
        }
        return rects.sort((a, b) => a[1] - b[1] || a[0] - b[0])
      }
      const rects = merge('rects')
      const rotation = ordered[0].rotation ?? 0
      const covered = Math.min(words.length, (ordered.length * chunkSize) + 3)
      return {
        page,
        label: ordered[0].label ?? '',
        rects,
        previewRects: rotation === 0 ? merge('previewRects') : [],
        coordinateSpace: 'pdf',
        rotation,
        text: clean,
        precision: 'text',
        partial: covered < words.length * 0.75,
        writable: rects.length > 0 && rotation === 0,
      }
    }
  }
  if (pageHint !== undefined && pageHint !== null) {
    return { page: pageHint, label: '', rects: [], previewRects: [], coordinateSpace: 'none', rotation: 0, text: '', precision: 'page', partial: true, writable: false }
  }
  return undefined
}

/** Split Zotero's indexed fulltext into pages (form-feed separated). */
export function splitFulltext(content) {
  const pages = String(content ?? '').split('\f')
  if (pages.length > 0 && pages[pages.length - 1].trim() === '') pages.pop()
  return pages.map((text, index) => ({ index, text: text.trim() }))
}

/** File size helper used to invalidate caches. */
export async function fileSignature(path) {
  try {
    const info = await stat(path)
    return `${info.size}-${Math.floor(info.mtimeMs)}`
  } catch {
    return 'missing'
  }
}
