import { toValueTree, labelFor } from './value-tree.js'

/**
 * Markdown export for the Zotero reader.
 *
 * Renders the combined result the reader currently shows (main analysis +
 * supplemental page ranges + synthesis), never "the first cached entry".
 * Human notes and author quotes are labelled separately from AI output.
 */

function stripHtml(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function rangeText(coverage) {
  if (coverage === undefined || coverage === null || coverage.readFrom === null) return '无正文'
  return coverage.readFrom === coverage.readTo
    ? `p.${coverage.readFrom}`
    : `p.${coverage.readFrom}–${coverage.readTo}`
}

/** Classify a Zotero note by the tags this plugin writes; unknown otherwise. */
function noteOrigin(note) {
  const tags = (note.tags ?? []).map((tag) => String(tag))
  if (tags.some((tag) => tag.startsWith('dsh-zotero:evidence'))) return { kind: 'ai-evidence', label: 'AI 证据摘录' }
  if (tags.some((tag) => tag === 'dsh-zotero:ai')) return { kind: 'ai', label: 'AI 笔记' }
  if (tags.some((tag) => tag.startsWith('dsh-zotero'))) return { kind: 'ai-other', label: '插件创建（类型未标记）' }
  return { kind: 'unknown', label: '来源未标记' }
}

/** Plugin-created annotations are only known when they carry a dsh-zotero tag. */
function annotationOrigin(annotation) {
  const tags = (annotation.tags ?? []).map((tag) => String(tag))
  return tags.some((tag) => tag.startsWith('dsh-zotero'))
    ? '来源：插件创建（dsh-zotero 标签）'
    : '来源：未标记'
}

function cumulativeRanges(analysis) {
  const read = new Set()
  for (const coverage of [analysis.coverage, ...(analysis.supplements ?? []).map((supplement) => supplement.coverage)]) {
    if (coverage === undefined || coverage === null || coverage.readFrom === null) continue
    for (let page = coverage.readFrom; page <= coverage.readTo; page += 1) read.add(page)
  }
  return [...read].sort((left, right) => left - right)
}

function evidenceRows(analysis) {
  const entries = [
    ...(analysis.evidence ?? []),
    ...(analysis.supplements ?? []).flatMap((supplement) => supplement.evidence ?? []),
    ...(analysis.synthesis?.evidence ?? []),
  ]
  const seen = new Set()
  const rows = []
  for (const entry of entries) {
    const id = `${entry.page ?? ''}|${String(entry.quote ?? '').trim()}`
    if (seen.has(id)) continue
    seen.add(id)
    rows.push(entry)
  }
  return rows
}

/**
 * @param {object} options
 * @param {object} options.detail - item metadata (title, creators, year, publication, doi, key, pdf)
 * @param {object} options.analysis - combined analysis (main + supplements + synthesis)
 * @param {string} options.focus - research focus the result belongs to
 * @param {Array} [options.notes] - Zotero notes ({note, tags})
 * @param {Array} [options.annotations] - Zotero annotations ({text, comment, pageLabel, color, key})
 * @param {Array} [options.conversations] - Q&A turns ({question, answer})
 * @param {boolean} [options.includeRaw]
 * @param {boolean} [options.includeAnnotations]
 * @param {boolean} [options.includeConversations]
 * @param {boolean} [options.includeDiagnostics]
 */
export function renderMarkdown(options) {
  const {
    detail,
    analysis,
    focus = '',
    notes = [],
    annotations = [],
    conversations = [],
    includeRaw = false,
    includeAnnotations = false,
    includeConversations = false,
    includeDiagnostics = false,
    generatedAt = Date.now(),
  } = options
  const warnings = []
  const lines = []
  const pdf = detail.pdf
  const itemUrl = `zotero://select/library/items/${detail.key}`
  const pageUrl = (page) => (pdf ? `zotero://open-pdf/library/items/${pdf.key}?page=${page}` : itemUrl)
  const ranges = cumulativeRanges(analysis)
  const synthesis = analysis.synthesis

  lines.push(`# ${detail.title}`, '')
  lines.push(`- 作者：${(detail.creators ?? []).join(', ') || '未知'}`)
  lines.push(`- 年份：${detail.year || '未知'}`)
  lines.push(`- 来源：${detail.publication || '未知'}`)
  lines.push(`- DOI：${detail.doi || '无'}`)
  lines.push(`- 研究关注点：${focus || '未指定'}`)
  lines.push(`- 阅读范围：${ranges.length === 0 ? '无正文' : rangeText({ readFrom: ranges[0], readTo: ranges[ranges.length - 1] })}（累计 ${ranges.length} 页）`)
  lines.push(`- Zotero：[条目](${itemUrl})${pdf ? ` · [PDF 第 ${ranges[0] ?? 1} 页](${pageUrl(ranges[0] ?? 1)})` : ''}`)
  lines.push(`- 导出时间：${new Date(generatedAt).toISOString()}`)
  lines.push('')

  if (synthesis) {
    lines.push('## 综合结论（AI，基于全部已读批次）', '')
    for (const [field, label] of [
      ['question', '研究问题'],
      ['methods', '方法与材料'],
      ['conditions', '实验条件/数据'],
      ['results', '主要结果'],
      ['limitations', '局限与不确定'],
      ['relevance', '与研究关注点的关系'],
    ]) {
      if (synthesis[field]) lines.push(`**${label}**：${synthesis[field]}`, '')
    }
    if ((synthesis.conflicts ?? []).length > 0) {
      lines.push('### 分批矛盾', '')
      for (const conflict of synthesis.conflicts) {
        lines.push(`- ${conflict.topic ?? ''}（${conflict.batches ?? ''}）：${conflict.resolution ?? ''}${conflict.status ? `［${conflict.status}］` : ''}`)
      }
      lines.push('')
    }
    if ((synthesis.uncertainties ?? []).length > 0) {
      lines.push('### 未解决 / 待核实', '')
      for (const item of synthesis.uncertainties) lines.push(`- ${item}`)
      lines.push('')
    }
    if (synthesis.coverage) {
      lines.push(`> 本综合依据：${rangeText(synthesis.coverage)} / 共 ${synthesis.coverage.pagesTotal} 页${(synthesis.coverage.missing ?? []).length > 0 ? `；未读 ${synthesis.coverage.missing.map(([a, b]) => (a === b ? `p.${a}` : `p.${a}–${b}`)).join('、')}` : '；已覆盖全文'}`, '')
    }
  } else {
    warnings.push('当前结果还没有综合结论；以下按分批结果导出。')
    lines.push('## 综合结论', '', '> 尚未生成综合结论，以下为分批分析。', '')
  }

  const rows = evidenceRows(analysis)
  if (rows.length > 0) {
    lines.push('## 关键证据（原文引用）', '')
    lines.push('| 页码 | 原文 | 支持的论断 | 定位 |')
    lines.push('|---|---|---|---|')
    for (const entry of rows) {
      const located = entry.verified === true
        ? entry.precision === 'text' ? (entry.partial ? '文字级·部分' : '文字级') : '页面级'
        : '未定位'
      lines.push(`| ${cell(entry.page ?? '?')} | ${cell(entry.quote ?? '')} | ${cell(entry.why ?? '')} | ${located} |`)
    }
    lines.push('')
  } else {
    warnings.push('没有可导出的证据条目。')
  }

  if (notes.length > 0) {
    const aiNotes = notes.map((note) => ({ note, origin: noteOrigin(note) })).filter((entry) => entry.origin.kind.startsWith('ai'))
    const unknownNotes = notes.map((note) => ({ note, origin: noteOrigin(note) })).filter((entry) => entry.origin.kind === 'unknown')
    if (aiNotes.length > 0) {
      lines.push('## AI 生成笔记（Zotero 中存储，可能经用户编辑）', '')
      lines.push('> 由 dsh-zotero 写入；标签可识别来源，但无法自动判断内容是否被人工修改。', '')
      for (const { note, origin } of aiNotes) {
        const text = stripHtml(note.note)
        if (text === '') continue
        lines.push(`### [${origin.label}] ${note.key ?? ''}`, '')
        lines.push(text, '')
        lines.push(`> 标签：${(note.tags ?? []).join('、') || '无'}`, '')
      }
    }
    if (unknownNotes.length > 0) {
      lines.push('## 来源未标记的笔记（Zotero 中人工或外部创建）', '')
      lines.push('> 这些笔记没有 dsh-zotero 标签，无法确认由谁生成；不要把它们当作 AI 输出。', '')
      for (const { note, origin } of unknownNotes) {
        const text = stripHtml(note.note)
        if (text === '') continue
        lines.push(`### [${origin.label}] ${note.key ?? ''}`, '')
        lines.push(text, '')
      }
    }
  }

  if (includeAnnotations && annotations.length > 0) {
    lines.push('## Zotero 标注', '')
    lines.push('> 标注可能由用户创建，也可能由插件创建；没有 dsh-zotero 标签时无法确认来源，因此不标注为人工或 AI。', '')
    for (const annotation of annotations) {
      lines.push(`- p.${annotation.pageLabel ?? '?'} “${annotation.text ?? ''}”${annotation.comment ? `（批注：${annotation.comment}）` : ''}${annotation.color ? ` · 颜色 ${annotation.color}` : ''} · ${annotationOrigin(annotation)}`)
    }
    lines.push('')
  }

  if (includeConversations && conversations.length > 0) {
    lines.push('## 讨论记录（AI，来自插件问答）', '')
    for (const turn of conversations) {
      if (turn.question) lines.push(`**问**：${turn.question}`, '')
      if (turn.answer) lines.push(`**答**：${turn.answer}`, '')
    }
  }

  if (includeRaw) {
    lines.push('## 原始分批分析', '')
    const batches = [
      { label: '主分析', range: analysis.range, coverage: analysis.coverage, parsed: analysis.parsed },
      ...(analysis.supplements ?? []).map((supplement, index) => ({
        label: `补充 ${index + 1}`,
        range: supplement.range,
        coverage: supplement.coverage,
        parsed: supplement.parsed,
      })),
    ]
    for (const batch of batches) {
      lines.push(`### ${batch.label}（读取 ${rangeText(batch.coverage)}${batch.range ? `，请求 p.${batch.range[0]}–${batch.range[1]}` : ''}）`, '')
      const parsed = batch.parsed ?? {}
      for (const [field, value] of Object.entries(parsed)) {
        if (field === 'evidence' || value === null || value === '') continue
        lines.push(`- **${labelFor(field)}**：`, '', valueTreeToMarkdown(toValueTree(value), 1), '')
      }
      lines.push('')
    }
  }

  if (includeDiagnostics) {
    lines.push('## 诊断（可选 JSON）', '')
    lines.push('```json', JSON.stringify({ analysis, focus }, null, 2), '```', '')
  }

  return {
    markdown: lines.join('\n'),
    warnings,
    included: {
      synthesis: synthesis !== undefined,
      evidence: rows.length,
      notes: notes.length,
      aiNotes: notes.filter((note) => noteOrigin(note).kind.startsWith('ai')).length,
      unknownNotes: notes.filter((note) => noteOrigin(note).kind === 'unknown').length,
      annotations: includeAnnotations ? annotations.length : 0,
      conversations: includeConversations ? conversations.length : 0,
      rawBatches: includeRaw ? (analysis.supplements ?? []).length + 1 : 0,
    },
  }
}

/** Readable Markdown export of the research question workspace. */
export function renderResearchMarkdown(questions, generatedAt = Date.now()) {
  const lines = ['# 研究问题', '', `导出时间：${new Date(generatedAt).toISOString()}`, '', '> 本文件只包含插件中的研究问题工作区，不包含 Zotero 原库、PDF 全文或附件。', '']
  if (questions.length === 0) lines.push('（暂无研究问题）', '')
  for (const question of questions) {
    lines.push(`## ${question.title}`, '')
    lines.push(`- 状态：${question.status ?? '待验证'}`)
    if (question.updatedAt) lines.push(`- 最近更新：${new Date(question.updatedAt).toISOString()}`)
    lines.push('')
    if (question.understanding) lines.push('### 当前理解', '', question.understanding, '')
    if ((question.openQuestions ?? []).length > 0) {
      lines.push('### 未解决问题', '')
      for (const item of question.openQuestions) lines.push(`- ${item}`)
      lines.push('')
    }
    if ((question.nextActions ?? []).length > 0) {
      lines.push('### 下一步行动', '')
      for (const item of question.nextActions) lines.push(`- ${item}`)
      lines.push('')
    }
    const materials = question.materials ?? {}
    if ((materials.papers ?? []).length > 0 || (materials.evidence ?? []).length > 0 || (materials.conversations ?? []).length > 0) {
      lines.push('### 关联材料', '')
      for (const key of materials.papers ?? []) lines.push(`- 文献：[${key}](zotero://select/library/items/${key})（Zotero key ${key}）`)
      for (const evidence of materials.evidence ?? []) {
        lines.push(`- 证据［${evidence.stance ?? '待验证'}］p.${evidence.page ?? '?'} “${evidence.quote ?? ''}”${evidence.why ? ` — ${evidence.why}` : ''}${evidence.paperKey ? `（[${evidence.paperKey}](zotero://select/library/items/${evidence.paperKey})）` : ''}`)
      }
      for (const conversation of materials.conversations ?? []) {
        lines.push(`- 对话［${conversation.stance ?? '待验证'}］${conversation.title ?? conversation.sessionId ?? ''}`)
      }
      lines.push('')
    }
    if ((question.evolution ?? []).length > 0) {
      lines.push('### 理解演变', '')
      for (const entry of question.evolution) {
        lines.push(`- ${new Date(entry.at).toLocaleString()}：${entry.summary || '（未记录文字）'}${typeof entry.materials === 'number' ? `（当时材料 ${entry.materials} 项）` : ''}`)
      }
      lines.push('')
    }
  }
  return lines.join('\n')
}


/** Markdown rendering that mirrors the reader's field labels and structure. */
export function valueTreeToMarkdown(tree, depth = 0) {
  const indent = '  '.repeat(depth)
  if (tree.kind === 'scalar') return `${indent}${tree.text}`
  if (tree.kind === 'array') {
    if (tree.items.length === 0) return `${indent}（无）`
    return tree.items.map((item) => {
      if (item.kind === 'scalar') return `${indent}- ${item.text}`
      return `${indent}-`, valueTreeToMarkdown(item, depth + 1)
    }).join('\n')
  }
  const lines = []
  for (const entry of tree.entries) {
    if (entry.tree.kind === 'scalar') {
      lines.push(`${indent}- **${entry.label}**：${entry.tree.text}`)
    } else {
      lines.push(`${indent}- **${entry.label}**：`)
      lines.push(valueTreeToMarkdown(entry.tree, depth + 1))
    }
  }
  return lines.join('\n')
}
