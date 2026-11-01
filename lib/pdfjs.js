/**
 * Cross-platform PDF text backend (pdfjs-dist, Apache-2.0).
 *
 * Page count, page text, quote location and PDF-space rectangles work on
 * macOS/Windows/Linux without native builds. Image rendering is not provided by
 * this backend; the macOS PDFKit helper remains an optional renderer.
 */
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
let pdfjsRoot
try { pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json')) } catch { pdfjsRoot = undefined }
const resourcePath = (name) => (pdfjsRoot === undefined ? undefined : `${join(pdfjsRoot, name)}/`)

/** Read CMaps from the installed package with fs (Node fetch has no file://). */
class FileCMapReaderFactory {
  constructor({ baseUrl, isCompressed }) {
    this.baseUrl = baseUrl
    this.isCompressed = isCompressed
  }
  async fetch({ name }) {
    const url = `${this.baseUrl}${name}${this.isCompressed ? '.bcmap' : ''}`
    const data = await readFile(url)
    return { cMapData: new Uint8Array(data), isCompressed: this.isCompressed }
  }
}

let pdfjsPromise

async function loadPdfjs() {
  pdfjsPromise = pdfjsPromise ?? import('pdfjs-dist/legacy/build/pdf.mjs')
  return pdfjsPromise
}

async function openDocument(pdfPath) {
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await readFile(pdfPath))
  const options = { data, useSystemFonts: true, isEvalSupported: false }
  const cMapUrl = resourcePath('cmaps')
  if (cMapUrl !== undefined) {
    options.cMapUrl = cMapUrl
    options.cMapPacked = true
    options.CMapReaderFactory = FileCMapReaderFactory
  }
  return pdfjs.getDocument(options).promise
}

/**
 * Two coordinate spaces, matching Zotero's official p2v/v2p split:
 * - pdfRect: PDF user space (bottom-left, y-up) — persisted annotation rects.
 * - previewRect: rotated viewport space (top-left, y-down) — page crops only.
 */
function itemRect(item, viewport) {
  const x = Number(item.transform?.[4] ?? 0)
  const y = Number(item.transform?.[5] ?? 0)
  const width = Number(item.width ?? 0)
  const height = Number(item.height ?? (Math.abs(item.transform?.[3] ?? 0) || 10))
  // transform is the baseline in PDF space. Build the glyph box in viewport
  // space, then invert the same corners with convertToPdfPoint so both rects
  // describe exactly the same region (including rotation).
  const [vx, vy] = viewport.convertToViewportPoint(x, y)
  const preview = [vx, vy - height, vx + width, vy]
  const [ax, ay] = viewport.convertToPdfPoint(preview[0], preview[1])
  const [bx, by] = viewport.convertToPdfPoint(preview[2], preview[3])
  const pdf = [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]
  return { pdf, preview }
}

function mergeLineRects(rects) {
  const sorted = [...rects].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const merged = []
  for (const rect of sorted) {
    const last = merged[merged.length - 1]
    if (last !== undefined && Math.abs(last[1] - rect[1]) < 2 && rect[0] <= last[2] + 2) {
      last[2] = Math.max(last[2], rect[2])
      last[3] = Math.max(last[3], rect[3])
    } else merged.push([...rect])
  }
  return merged
}

/** Page text lines and per-item rectangles in PDF coordinates (y-up). */
export async function pdfjsPages(pdfPath) {
  const doc = await openDocument(pdfPath)
  const pages = []
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number)
    const viewport = page.getViewport({ scale: 1 })
    const text = await page.getTextContent()
    const lines = new Map()
    const segments = []
    const chars = []
    let cursor = 0
    let joined = ''
    for (const item of text.items) {
      if (typeof item.str !== 'string') continue
      const str = item.str.normalize('NFKC').replace(/\s+/g, ' ')
      const rect = itemRect(item, viewport)
      if (str.trim() !== '') {
        segments.push({ start: cursor, end: cursor + str.length, rect, text: str })
        for (const ch of str) if (!/\s/.test(ch)) chars.push({ ch: ch.normalize('NFKC').toLowerCase(), segment: segments.length - 1 })
      }
      joined += str
      cursor += str.length
      if (!/\s$/.test(joined) && str !== '') { joined += ' '; cursor += 1 }
      const key = Math.round(rect.preview[1] / 3) * 3
      const line = lines.get(key) ?? { y: rect.preview[1], items: [] }
      line.items.push({ str, rect })
      lines.set(key, line)
    }
    // previewRect y grows downward; text order is top-to-bottom.
    const ordered = [...lines.values()].sort((a, b) => a.y - b.y)
    const pageText = ordered.map((line) => line.items.map((entry) => entry.str).join('').normalize('NFKC').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
    pages.push({
      index: number - 1,
      width: viewport.width,
      height: viewport.height,
      rotation: viewport.rotation ?? 0,
      view: Array.isArray(page.view) ? page.view.slice(0, 4) : [0, 0, viewport.width, viewport.height],
      text: pageText,
      joined,
      segments,
      chars,
    })
  }
  await doc.destroy()
  return pages
}

/** Same shape as the PDFKit helper's info command. */
export async function pdfjsInfo(pdfPath) {
  const pages = await pdfjsPages(pdfPath)
  return {
    pageCount: pages.length,
    pages: pages.map((page) => ({ index: page.index, width: page.width, height: page.height, label: String(page.index + 1) })),
  }
}

/** Page texts for Zotero-fulltext fallback. */
export async function pdfjsExtractPages(pdfPath) {
  return (await pdfjsPages(pdfPath)).map((page) => ({ index: page.index, text: page.text }))
}

export async function pdfjsPageCount(pdfPath) {
  return (await pdfjsPages(pdfPath)).length
}

function normalize(text) {
  return String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Locate a quote with PDF.js text items; returns helper-compatible results. */
export async function pdfjsLocate(pdfPath, quote, pageHint) {
  const needle = normalize(quote)
  if (needle.length < 4) return undefined
  const pages = await pdfjsPages(pdfPath)
  const order = pageHint === undefined || pageHint === null
    ? pages
    : [...pages.filter((page) => page.index === pageHint), ...pages.filter((page) => page.index !== pageHint)]
  for (const page of order) {
    const haystack = page.joined.toLowerCase()
    const start = haystack.indexOf(needle)
    let selected = []
    if (start >= 0) {
      const end = start + needle.length
      selected = page.segments.filter((segment) => segment.end > start && segment.start < end)
    }
    if (selected.length === 0) {
      // CJK PDFs often place one glyph per text item, so words carry spaces in
      // the joined string. Retry on a whitespace-free character stream.
      const compact = (page.chars ?? []).map((entry) => entry.ch).join('')
      const compactNeedle = needle.replace(/\s+/g, '')
      const compactStart = compact.indexOf(compactNeedle)
      if (compactStart >= 0) {
        const segmentIndexes = new Set()
        for (let index = compactStart; index < compactStart + compactNeedle.length; index += 1) segmentIndexes.add(page.chars[index].segment)
        selected = [...segmentIndexes].map((index) => page.segments[index])
      }
    }
    if (selected.length === 0) continue
    const pdfRects = mergeLineRects(selected.map((segment) => segment.rect.pdf))
    const rotation = page.rotation ?? 0
    // Rotated crops use unrotated page dimensions in the helper, so avoid a
    // misleading crop and fall back to the whole page.
    const previewRects = rotation === 0 ? mergeLineRects(selected.map((segment) => segment.rect.preview)) : []
    return {
      page: page.index,
      label: '',
      rects: pdfRects,
      previewRects,
      coordinateSpace: 'pdf',
      rotation,
      text: String(quote ?? ''),
      precision: pdfRects.length > 0 ? 'text' : 'page',
      partial: pdfRects.length === 0,
      writable: pdfRects.length > 0 && rotation === 0,
    }
  }
  if (pageHint !== undefined && pageHint !== null) {
    return { page: pageHint, label: '', rects: [], previewRects: [], coordinateSpace: 'pdf', rotation: 0, text: '', precision: 'page', partial: true, writable: false }
  }
  return undefined
}
