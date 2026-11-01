/**
 * Page-range selection for the model-facing `zotero_paper` tool.
 *
 * Accepted specs: "1" (single page), "1-5" (inclusive range), "1,3,5" (list),
 * "" or "all" (whole paper). Anything else is rejected instead of silently
 * falling back to the whole paper — that fallback is what made a request for
 * page 1 return all 16 pages.
 */

/** Parse one pages argument. Throws on an unsupported spelling. */
export function parsePageSpec(spec) {
  const text = String(spec ?? '').trim()
  if (text === '' || text.toLowerCase() === 'all') return { kind: 'all' }
  const range = /^(\d+)\s*-\s*(\d+)$/.exec(text)
  if (range !== null) {
    const from = Number(range[1])
    const to = Number(range[2])
    if (from < 1 || to < from) throw new Error(`pages 范围无效："${text}"（起止页码必须从 1 开始且起点不大于终点）`)
    return { kind: 'range', from, to }
  }
  if (/^\d+$/.test(text)) {
    const page = Number(text)
    if (page < 1) throw new Error(`pages 页码无效："${text}"`)
    return { kind: 'single', page }
  }
  if (/^\d+(\s*,\s*\d+)+$/.test(text)) {
    const pages = text.split(',').map((part) => Number(part.trim())).filter((page) => page >= 1)
    if (pages.length === 0) throw new Error(`pages 列表无效："${text}"`)
    return { kind: 'list', pages }
  }
  throw new Error(`pages 参数无效："${text}"；可用 "1"、"1-5"、"1,3,5" 或 "all"`)
}

/** Select the requested pages from a full page list. */
export function selectPages(pages, spec) {
  const parsed = parsePageSpec(spec)
  if (parsed.kind === 'all') return { parsed, selected: pages }
  if (parsed.kind === 'single') {
    const selected = pages.filter((page) => page.index + 1 === parsed.page)
    if (selected.length === 0) throw new Error(`没有第 ${parsed.page} 页（这篇共 ${pages.length} 页）`)
    return { parsed, selected }
  }
  if (parsed.kind === 'range') {
    const selected = pages.filter((page) => page.index + 1 >= parsed.from && page.index + 1 <= parsed.to)
    if (selected.length === 0) throw new Error(`第 ${parsed.from}–${parsed.to} 页不在范围内（这篇共 ${pages.length} 页）`)
    return { parsed, selected }
  }
  const wanted = new Set(parsed.pages)
  const selected = pages.filter((page) => wanted.has(page.index + 1))
  if (selected.length === 0) throw new Error(`没有第 ${parsed.pages.join(', ')} 页（这篇共 ${pages.length} 页）`)
  return { parsed, selected }
}

/** Describe the requested range for the tool's reply. */
export function describeSelection(parsed, selected, total) {
  const numbers = selected.map((page) => page.index + 1)
  if (numbers.length === 0) return `共 ${total} 页，本次没有可提供的页`
  const first = numbers[0]
  const last = numbers[numbers.length - 1]
  const contiguous = numbers.length === last - first + 1
  const range = numbers.length === 1
    ? `第 ${first} 页`
    : contiguous ? `第 ${first}–${last} 页` : `第 ${numbers.join(', ')} 页`
  return `共 ${total} 页，本次提供${range}（${numbers.length} 页）`
}

/**
 * Build the model-facing text for one paper. Only the selected pages are
 * included; a character cap notes its own truncation instead of dropping the
 * page-scope claim.
 */
export function buildPaperText(detail, pages, spec, { maxChars = 20000, baseText } = {}) {
  const { parsed, selected } = selectPages(pages, spec)
  let body = ''
  let truncatedByChars = false
  const included = []
  for (const page of selected) {
    const block = `\n[[p.${page.index + 1}]]\n${page.text}\n`
    if (body.length + block.length > maxChars) {
      truncatedByChars = true
      break
    }
    body += block
    included.push(page)
  }
  const lines = baseText === undefined ? [] : [baseText]
  lines.push('', describeSelection(parsed, included, pages.length), '', body)
  if (truncatedByChars) lines.push('\n[本次提供的内容达到字符上限，后续页面未包含；可缩小 pages 范围重试]')
  return {
    text: lines.join('\n'),
    selection: {
      spec: String(spec ?? 'all'),
      requested: parsed.kind,
      pages: included.map((page) => page.index + 1),
      truncatedByChars,
    },
  }
}
