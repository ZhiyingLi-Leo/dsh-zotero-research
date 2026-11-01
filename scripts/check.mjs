/** Pure Node checks that can run on macOS, Windows and Linux CI. */
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const moduleUrl = (name) => pathToFileURL(join(root, name)).href
const { VERSION } = await import(moduleUrl('lib/version.js'))
const backup = await import(moduleUrl('lib/backup.js'))
const { zoteroOpenCommand } = await import(moduleUrl('lib/open.js'))
const { pdfjsPages, pdfjsLocate } = await import(moduleUrl('lib/pdfjs.js'))
const { locateQuote } = await import(moduleUrl('lib/pdf.js'))
const { toValueTree } = await import(moduleUrl('lib/value-tree.js'))
const { valueTreeToMarkdown, renderMarkdown } = await import(moduleUrl('lib/markdown.js'))
const { ZoteroClient, formatAnnotationSortIndex } = await import(moduleUrl('lib/zotero.js'))

assert.equal(pkg.version, VERSION, 'package.json and lib/version.js agree')
assert.match(pkg.engines.dsh, /0\.2\.1-rc\.5/, 'DSH engine includes tested prerelease')

const sample = JSON.parse(await readFile(join(root, 'examples/sample-backup.json'), 'utf8'))
assert.equal(backup.validateBackup(sample).ok, true, 'synthetic sample backup validates')
for (const bad of [
  { format: 'dsh-zotero-backup', version: 1, data: { analyses: [{ key: 'TEST0001', mode: 'quick', focus: 'f', analysis: { parsed: { question: { x: 1 } } } }] } },
  { format: 'dsh-zotero-backup', version: 1, data: { analyses: [{ key: 'TEST0001', mode: 'quick', focus: 'f', analysis: { parsed: { evidence: 'no' }, supplements: 'no' } }] } },
  { format: 'dsh-zotero-backup', version: 1, data: { analyses: [{ key: 'TEST0001', mode: 'quick', focus: 'f', analysis: { synthesis: { evidence: 'no' } } }] } },
]) assert.equal(backup.validateBackup(bad).ok, false, 'invalid payload rejected')

assert.deepEqual(zoteroOpenCommand('zotero://select/library/items/TEST0001', 'darwin'), { command: 'open', args: ['-a', 'Zotero', 'zotero://select/library/items/TEST0001'] })
assert.equal(zoteroOpenCommand('zotero://select/library/items/TEST0001', 'win32').command, 'rundll32.exe')
assert.equal(zoteroOpenCommand('zotero://select/library/items/TEST0001', 'linux').command, 'xdg-open')
assert.throws(() => zoteroOpenCommand('https://example.com', 'linux'))

function makePdf(pages) {
  const objects = []
  const pageIds = []
  const fontId = 3 + pages.length * 2
  pages.forEach((page, index) => {
    const pageId = 3 + index * 2
    const contentId = pageId + 1
    pageIds.push(pageId)
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}]${page.rotate ? ` /Rotate ${page.rotate}` : ''} /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    objects[contentId - 1] = `<< /Length ${Buffer.byteLength(page.stream)} >>\nstream\n${page.stream}\nendstream`
  })
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  objects[fontId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index <= objects.length; index += 1) body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body)
}

function makeCjkPdf(text) {
  const hex = [...text].map((ch) => ch.codePointAt(0).toString(16).padStart(4, '0')).join('')
  const stream = `BT /F1 14 Tf 72 720 Td <${hex}> Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [6 0 R] >>',
    '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /FontDescriptor 7 0 R >>',
    '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 4 /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 80 >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index <= objects.length; index += 1) body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body)
}

function textStream(lines) {
  return lines.map(([x, y, size, text]) => `BT /F1 ${size} Tf ${x} ${y} Td (${text}) Tj ET`).join('\n')
}

const dir = await mkdtemp(join(tmpdir(), 'dsh-zotero-check-'))
try {
  const pdfPath = join(dir, 'fixture.pdf')
  const pages = [
    {
      width: 612, height: 792,
      stream: textStream([
        [72, 760, 12, 'Top line first'],
        [72, 740, 12, 'Bottom line second'],
        [72, 720, 12, 'Left column synthetic line'],
        [320, 720, 12, 'Right column unique phrase'],
        [320, 700, 12, 'Second right line'],
      ]),
    },
    { width: 400, height: 600, rotate: 90, stream: textStream([[60, 540, 12, 'Rotated page text']]) },
    { width: 612, height: 792, stream: '0 0 0 rg 20 20 100 100 re f' },
  ]
  await writeFile(pdfPath, makePdf(pages))
  const parsed = await pdfjsPages(pdfPath)
  assert.equal(parsed.length, 3, 'multi-page page count')
  assert.match(parsed[0].text, /Left column synthetic line/, 'left column text')
  assert.ok(parsed[0].text.indexOf('Top line first') < parsed[0].text.indexOf('Bottom line second'), 'page text is top-to-bottom')
  const right = await pdfjsLocate(pdfPath, 'Right column unique phrase', 0)
  assert.equal(right.page, 0, 'right column page')
  assert.ok(right.rects.length > 0 && right.rects[0][0] > 300, 'right column rectangle')
  const realRight = await locateQuote(pdfPath, 'Right column unique phrase', 0)
  assert.equal(realRight.coordinateSpace, 'pdf', 'real locateQuote returns PDF-space rects')
  assert.equal(realRight.writable, true, 'real locateQuote keeps writable text matches')
  assert.ok(realRight.previewRects.length > 0, 'real locateQuote keeps preview rects')
  assert.equal(right.coordinateSpace, 'pdf', 'annotation rects are PDF space')
  assert.ok(right.rects[0][1] > right.previewRects[0][1], 'PDF y-up and preview y-down are distinct')
  assert.ok(Math.abs((right.rects[0][3] + right.previewRects[0][1]) - 792) < 2, 'preview top projects to PDF top')
  assert.ok(Math.abs((right.rects[0][1] + right.previewRects[0][3]) - 792) < 2, 'preview bottom projects to PDF bottom')
  assert.ok(Math.abs(parsed[1].width - 600) < 1 && Math.abs(parsed[1].height - 400) < 1, 'rotated page viewport')
  const rotatedHit = await pdfjsLocate(pdfPath, 'Rotated page text', 1)
  const realRotated = await locateQuote(pdfPath, 'Rotated page text', 1)
  assert.equal(realRotated.writable, false, 'real locateQuote disables rotated write-back')
  assert.equal(realRotated.previewRects.length, 0, 'real locateQuote drops rotated preview rects')
  const realNone = await locateQuote(pdfPath, 'text that does not exist', 0)
  assert.equal(realNone.coordinateSpace, 'none', 'page-level fallback has no coordinate source')
  assert.equal(realNone.writable, false, 'page-level fallback is not writable')
  assert.equal(rotatedHit.writable, false, 'rotated page is not annotation-writable')
  assert.equal(rotatedHit.previewRects.length, 0, 'rotated page falls back to page image')
  assert.equal(parsed[2].text.trim(), '', 'image-only page has no text layer')
  const noMatch = await pdfjsLocate(pdfPath, 'text that does not exist', 0)
  assert.ok(noMatch === undefined || (noMatch.precision === 'page' && noMatch.rects.length === 0), 'no match is not faked')

  const cnPath = join(dir, 'cn.pdf')
  await writeFile(cnPath, makeCjkPdf('中文证据'))
  const cnPages = await pdfjsPages(cnPath)
  assert.match(cnPages[0].text, /中文证据/, 'CMap Chinese text extraction (pure Node)')
  const cnLoc = await pdfjsLocate(cnPath, '中文证据', 0)
  assert.ok(cnLoc && cnLoc.rects.length > 0, 'CMap Chinese quote location (pure Node)')
  const cnReal = await locateQuote(cnPath, '中文证据', 0)
  assert.equal(cnReal.coordinateSpace, 'pdf', 'real locateQuote Chinese PDF space')
  assert.equal(cnReal.writable, true, 'real locateQuote Chinese writable')
  assert.ok(cnReal.previewRects.length > 0, 'real locateQuote Chinese preview rects')
  assert.equal(cnLoc.coordinateSpace, 'pdf', 'Chinese annotation rects are PDF space')
  assert.ok(cnLoc.rects[0][1] > cnLoc.previewRects[0][1], 'Chinese PDF/preview coordinates differ')
  const cnHeight = cnPages[0].height
  assert.ok(Math.abs((cnLoc.rects[0][3] + cnLoc.previewRects[0][1]) - cnHeight) < 2, 'Chinese preview top projects to PDF top')
  assert.ok(Math.abs((cnLoc.rects[0][1] + cnLoc.previewRects[0][3]) - cnHeight) < 2, 'Chinese preview bottom projects to PDF bottom')
} finally {
  await rm(dir, { recursive: true, force: true })
}
const lower = formatAnnotationSortIndex({ page: 0, rect: [50, 700, 122, 720], pageHeight: 792 })
const upper = formatAnnotationSortIndex({ page: 0, rect: [50, 750, 122, 770], pageHeight: 792 })
assert.equal(lower, '00000|000000|00072', 'page 0 prefix + distance from PDF top')
assert.equal(upper, '00000|000000|00022', 'same-page upper distance')
assert.ok(upper < lower, 'same-page upper sorts before lower')
assert.equal(formatAnnotationSortIndex({ page: 0, rect: [50, 700, 122, 720], pageHeight: 792, pageRotation: 90 }), '00000|000000|00000', 'rotated page does not fake precision')
assert.equal(formatAnnotationSortIndex({ page: 0, rect: [50, 700, 122, 720] }), '00000|000000|00000', 'missing page height does not fake precision')

const fake = new ZoteroClient()
let payload
fake.request = async (_path, options) => { payload = typeof options.body === 'string' ? JSON.parse(options.body) : options.body; return [{ key: 'FAKEANN01' }] }
await fake.createAnnotation({ parentItem: 'TEST0001', page: 1, rects: [[50, 700, 122, 720]], text: '中文证据', pageHeight: 792 })
assert.equal(payload[0].annotationSortIndex, '00001|000000|00072', 'real createAnnotation payload uses 0-based page index')
assert.equal(formatAnnotationSortIndex({ page: 0, rect: [50, 700, 122, 720], pageHeight: 792 }), '00000|000000|00072', 'first page prefix 00000')
assert.deepEqual(JSON.parse(payload[0].annotationPosition), { pageIndex: 1, rects: [[50, 700, 122, 720]] }, 'payload keeps PDF rects unchanged')
const structured = {
  equations: [{ expression: 'a^2 + b^2 = c^2', variables: 'a, b, c', assumptions: 'right triangle', meaning: 'Pythagoras' }],
  figures: [{ label: 'Fig. 1', what: 'setup', condition: 'in vitro', takeaway: 'works' }],
  reproduction: { params: ['n=3'], equipment: ['MMF'], data: [], code: [], missing: ['calibration'] },
  unknownField: { nested: 'kept' },
}
const structuredMd = valueTreeToMarkdown(toValueTree(structured))
for (const label of ['表达式', '变量与单位', '假设', '意义', '编号', '内容', '条件/对照', '结论', '参数', '设备', '缺失', 'unknownField', 'nested']) {
  assert.ok(structuredMd.includes(label), `structured Markdown label ${label}`)
}
assert.ok(!structuredMd.includes('{"expression"'), 'structured Markdown is not raw JSON')
const exportDetail = { title: 'Synthetic export paper', creators: ['A'], year: '2026', publication: 'Test', doi: '', key: 'TEST0001', pdf: { key: 'TESTPDF1' } }
const exportAnalysis = {
  mode: 'deep', key: 'TEST0001', basis: '部分正文',
  coverage: { pagesTotal: 4, readFrom: 1, readTo: 2, missing: [[3, 4]] },
  parsed: {
    question: 'Synthetic question',
    equations: [{ expression: 'E = mc^2', variables: 'E, m, c', assumptions: 'vacuum', meaning: 'energy' }],
    figures: [{ label: 'Fig 1', what: 'setup', condition: 'in vitro', takeaway: 'works' }],
    reproduction: { params: ['n=3'], equipment: ['MMF'], data: [], code: [], missing: ['calibration'] },
    unknownField: { nested: 'kept' },
  },
  evidence: [{ quote: 'Synthetic evidence quote', page: 1, verified: true, precision: 'text', why: 'supports claim' }],
  supplements: [{ range: [3, 4], basis: '部分正文', coverage: { pagesTotal: 4, readFrom: 3, readTo: 4 }, parsed: { results: 'Synthetic supplement result' }, evidence: [] }],
  synthesis: { question: 'Synthetic synthesis', evidence: [{ quote: 'Synthetic synthesis quote', page: 2, verified: true, precision: 'text' }], uncertainties: ['one unknown'] },
}
const exportMd = renderMarkdown({
  detail: exportDetail,
  analysis: exportAnalysis,
  focus: 'synthetic focus',
  notes: [{ note: '<p>Synthetic manual note</p>', tags: [] }, { note: '<p>Synthetic AI note</p>', tags: ['dsh-zotero:ai'] }],
  annotations: [{ text: 'Synthetic annotation', pageLabel: '2', comment: 'mine', tags: [] }],
  conversations: [{ question: 'Synthetic Q?', answer: 'Synthetic A.' }],
  includeRaw: true,
  includeAnnotations: true,
  includeConversations: true,
}).markdown
for (const needle of ['表达式', '编号', '参数', 'AI 生成笔记', '来源未标记的笔记', 'Synthetic Q?', 'Synthetic A.', '原始分批分析']) {
  assert.ok(exportMd.includes(needle), `export Markdown contains ${needle}`)
}
assert.ok(!exportMd.includes('{"expression"'), 'export does not print raw structured JSON')
console.log('checks passed: version, backup validation, platform open, pdfjs fixture, locateQuote, sort index, structured fields, real export')
