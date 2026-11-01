/** Read-only synthetic Zotero local API for real UI screenshots (demo data only). */
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const PORT = Number(process.env.DEMO_ZOTERO_PORT ?? 23120)
const PDF = '/tmp/dsh-zotero-research-demo.pdf'

// Minimal single-page PDF with searchable English demo text.
const stream = 'BT /F1 16 Tf 72 700 Td (Demo evidence: a single-ended multimode fiber senses shape.) Tj ET'
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
]
let pdf = '%PDF-1.4\n'
const offsets = [0]
objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
const xref = Buffer.byteLength(pdf)
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
writeFileSync(PDF, pdf)

const paper = {
  key: 'DEMO0001', version: 1, data: {
    itemType: 'journalArticle', title: 'Synthetic shape sensing with a single-ended fiber (demo)',
    creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Example' }],
    date: '2026', publicationTitle: 'Demo Journal', DOI: '10.0000/demo',
    abstractNote: 'Synthetic abstract for screenshots only. It describes a demo sensor and a demo experiment.',
    tags: [{ tag: 'demo' }, { tag: 'shape-sensing' }], dateModified: '2026-01-01T00:00:00Z',
  },
}
const attachments = [{ key: 'DEMOPDF1', version: 1, data: { itemType: 'attachment', parentItem: 'DEMO0001', title: 'Demo PDF', filename: 'demo.pdf', contentType: 'application/pdf' } }]
const notes = [{ key: 'DEMONOTE1', version: 1, data: { itemType: 'note', parentItem: 'DEMO0001', note: '<p>Demo note: check the calibration paragraph.</p>', tags: [], dateModified: '2026-01-01T00:00:00Z' } }]
const annotations = [{ key: 'DEMOANN1', version: 1, data: { itemType: 'annotation', parentItem: 'DEMOPDF1', annotationType: 'highlight', annotationText: 'Demo evidence: a single-ended multimode fiber senses shape.', annotationComment: 'Demo comment', annotationColor: '#ffd400', annotationPageLabel: '1', annotationPosition: JSON.stringify({ pageIndex: 0, rects: [[72, 700, 400, 720]] }), tags: [], dateModified: '2026-01-01T00:00:00Z' } }]
const collections = [{ key: 'DEMOCOLL1', version: 1, data: { key: 'DEMOCOLL1', name: 'Demo collection', parentCollection: false } }, { key: 'DEMOCOLL2', version: 1, data: { key: 'DEMOCOLL2', name: 'Demo methods', parentCollection: false } }]
const allItems = [paper, ...attachments, ...notes, ...annotations]

function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json', 'x-zotero-version': '10.0.7-demo', 'zotero-schema-version': '9', ...headers })
  response.end(body === undefined ? '' : JSON.stringify(body))
}

createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`)
  const path = url.pathname.replace('/api/users/0', '')
  if (path === '/items' || path === '/items/top') {
    let items = allItems
    if (url.searchParams.get('itemType')) items = items.filter((item) => item.data.itemType === url.searchParams.get('itemType'))
    if (path === '/items/top') items = items.filter((item) => !['attachment', 'note', 'annotation'].includes(item.data.itemType))
    const start = Number(url.searchParams.get('start') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 100)
    send(response, 200, items.slice(start, start + limit), { 'total-results': String(items.length) })
    return
  }
  if (path === '/collections') { send(response, 200, collections); return }
  if (path.startsWith('/collections/') && path.endsWith('/items')) { send(response, 200, [paper], { 'total-results': '1' }); return }
  if (path === '/items/DEMO0001') { send(response, 200, [paper]); return }
  if (path === '/items/DEMOPDF1/fulltext') { send(response, 200, { content: 'Demo evidence: a single-ended multimode fiber senses shape.\fSecond demo page text.', indexedPages: 2, totalPages: 2 }); return }
  if (path === '/items/DEMOPDF1/file') { send(response, 200, { redirect: pathToFileURL(PDF).href }); return }
  if (path === '/items/DEMO0001/children') { send(response, 200, [...attachments, ...notes]); return }
  if (path === '/items/DEMOPDF1/children') { send(response, 200, url.searchParams.get('itemType') === 'annotation' ? annotations : attachments); return }
  if (path.startsWith('/items/') && path.endsWith('/children')) { send(response, 200, []); return }
  send(response, 404, { error: 'demo mock: not found', path })
}).listen(PORT, '127.0.0.1', () => console.log(`demo Zotero API http://127.0.0.1:${PORT} (read-only, synthetic)`))
