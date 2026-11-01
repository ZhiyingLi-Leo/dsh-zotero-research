/** Seed a temporary DSH_HOME with synthetic plugin records for screenshots. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const home = process.env.DSH_HOME
if (!home) throw new Error('run with DSH_HOME=/tmp/demo-home')
const dir = join(home, 'storages', 'zotero-plugin')
mkdirSync(dir, { recursive: true })

const analysis = {
  key: 'DEMO0001', mode: 'deep', focus: '', basis: '部分正文',
  coverage: { pagesTotal: 2, pdfPageCount: 2, pagesRead: 1, readFrom: 1, readTo: 1, partialPage: false, truncated: true, missing: [[2, 2]] },
  parsed: {
    question: 'How does a single-ended fiber recover shape? (demo)',
    logic: 'Speckle patterns are decoded by a small network. (demo)',
    methodDetail: 'Synthetic method description for the demo.',
    equations: [{ expression: 'I(x,y) = |E(x,y)|^2', variables: 'I, E, x, y', assumptions: 'coherent light', meaning: 'intensity' }],
    figures: [{ label: 'Fig. 1 (demo)', what: 'fiber and readout', condition: 'bench test', takeaway: 'demo only' }],
    reproduction: { params: ['n=3'], equipment: ['single-ended MMF'], data: [], code: [], missing: ['calibration protocol'] },
    insights: ['Demo insight for screenshots.'],
    openQuestions: ['Demo open question?'],
  },
  evidence: [{
    quote: 'Demo evidence: a single-ended multimode fiber senses shape.', why: 'Demo support for the claim.', page: 1, pageLabel: '1',
    rects: [[72, 700, 400, 720]], previewRects: [[72, 72, 400, 92]], coordinateSpace: 'pdf', rotation: 0,
    verified: true, precision: 'text', partial: false, writable: true,
  }],
  generatedAt: Date.now(),
}
writeFileSync(join(dir, 'analyses.json'), JSON.stringify({
  'DEMO0001:deep:da39a3ee5e': { key: 'DEMO0001', mode: 'deep', focus: '', analysis, savedAt: Date.now() },
}, null, 2))
writeFileSync(join(dir, 'state.json'), JSON.stringify({ apiKeyRemembered: false, queue: { DEMO0001: { status: 'reading', priority: 1 } }, analyses: {}, notes: {}, themes: {}, relations: {}, settings: {} }, null, 2))
writeFileSync(join(dir, 'ask.json'), JSON.stringify({ DEMO0001: { paper: { turns: [{ role: 'user', content: 'What is the demo sensor medium?' }, { role: 'assistant', content: 'Demo answer: a single-ended multimode fiber, page 1.' }] } } }, null, 2))
writeFileSync(join(dir, 'research.json'), JSON.stringify({ questions: [{
  id: 'demo-question', title: 'How to separate contact force from shape change? (demo)', status: '待验证',
  understanding: 'Synthetic understanding for the example workspace.', openQuestions: ['Demo open question'], nextActions: ['Demo next action'],
  materials: { papers: ['DEMO0001'], evidence: [{ quote: 'Demo evidence: a single-ended multimode fiber senses shape.', page: 1, why: 'demo', stance: '支持', paperKey: 'DEMO0001' }], conversations: [] },
  evolution: [{ at: Date.now(), summary: 'Initial demo understanding', materials: 1 }], updatedAt: Date.now(),
}] }, null, 2))
console.log('seeded', dir)
