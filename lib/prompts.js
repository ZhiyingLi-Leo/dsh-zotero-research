/**
 * Prompt assembly for the Zotero workspace.
 *
 * Every analysis returns strict JSON (one object) so the UI can render sections
 * and verified evidence instead of scraping prose. Quotes are verified against
 * the PDF by the caller; the model is told never to invent page numbers.
 *
 * @module dsh-zotero/prompts
 */

const DISCIPLINE = `你是严谨的科研阅读助手。规则：
1. 只依据给出的标题、摘要和全文回答，不补充未给出的文献事实。
2. 区分四类内容：作者陈述、实验支持的结论、你的推断、用户观点。推断必须写明"推断"。
3. 引用原文时必须逐字摘录（可截取片段），不得改写；页码只能用文本里出现的 [[p.N]] 标记。
4. 找不到依据时写"文中未说明"，不要编造。
5. 输出严格 JSON，不要 Markdown 代码块，不要多余解释。`

/**
 * Take whole pages up to a character budget and report exactly how many fit.
 * Whole-page boundaries keep "已读范围" honest instead of implying a partial
 * page was fully read.
 */
export function coverPages(pages, { maxChars = 60000 } = {}) {
  let text = ''
  let pagesRead = 0
  let partialPage = false
  for (const page of pages) {
    const block = `\n[[p.${page.index + 1}]]\n${page.text}\n`
    if (pagesRead === 0 && block.length > maxChars) {
      text += `\n[[p.${page.index + 1}]]\n${page.text.slice(0, maxChars)}\n`
      partialPage = true
      break
    }
    if (text.length + block.length > maxChars) break
    text += block
    pagesRead += 1
  }
  const truncated = pagesRead < pages.length
  return {
    text,
    pagesRead,
    partialPage,
    truncated,
    missingFrom: truncated ? pagesRead + 1 : null,
    missingTo: truncated ? pages.length : null,
  }
}

/** Human line describing exactly which pages the model is given. */
export function coverageLine(coverage) {
  if (coverage === undefined) return ''
  if (coverage.pagesTotal === 0) return '本次没有提供正文，只能依据标题与摘要。'
  const from = coverage.readFrom ?? 1
  const to = coverage.readTo ?? coverage.pagesRead
  const complete = from === 1 && to === coverage.pagesTotal && coverage.truncated !== true && coverage.partialPage !== true
  if (complete) return `本次提供完整正文：第 1–${coverage.pagesTotal} 页（共 ${coverage.pagesTotal} 页）。`
  const missing = coverage.missing?.[0]
  const tail = missing === undefined ? '' : `；第 ${missing[0]}–${missing[1]} 页未提供，不能对未提供部分下结论`
  return `本次提供第 ${from}–${to} 页（共 ${coverage.pagesTotal} 页）${tail}。`
}

/** Render one page list as page-marked text, capped. */
export function pageText(pages, options) {
  return coverPages(pages, options).text
}

/** Metadata block shared by every prompt. */
export function metaBlock(item) {
  return [
    `标题：${item.title}`,
    `作者：${(item.creators ?? []).join(', ') || '未提供'}`,
    `年份：${item.year || '未提供'}`,
    `来源：${item.publication || '未提供'}`,
    `DOI：${item.doi || '未提供'}`,
    `Zotero key：${item.key ?? '未提供'}（回答引用这篇文献时必须原样使用此 key）`,
    `标签：${(item.tags ?? []).join(', ') || '无'}`,
    '',
    '摘要：',
    item.abstract || '（无摘要）',
  ].join('\n')
}

/** Quick screening prompt. */
export function quickPrompt(item, pages, focus, coverage) {
  const hasFull = pages.length > 0
  return {
    system: DISCIPLINE,
    user: `${metaBlock(item)}

${hasFull ? `${coverageLine(coverage)}\n\n正文（按页标记）：\n${coverage?.text ?? pageText(pages, { maxChars: 24000 })}` : '（没有全文，只能依据标题与摘要）'}

我的研究关注点：${focus || '（未指定）'}

任务：快速筛选这篇文献。只输出一个 JSON 对象：
{
  "question": "研究问题",
  "contribution": "主要贡献",
  "relevance": "与我的关注点的相关性（具体）",
  "priority": "高|中|低",
  "reason": "推荐理由",
  "basis": "标题|摘要|全文",
  "evidence": [{"quote": "逐字原文", "page": 数字, "why": "这条证据支持什么", "section": "screening"}]
}
evidence 给 1-3 条，必须逐字来自上面的文本。`,
  }
}

/** Rough read prompt. */
export function roughPrompt(item, pages, focus, coverage) {
  const hasFull = pages.length > 0
  return {
    system: DISCIPLINE,
    user: `${metaBlock(item)}

${hasFull ? `${coverageLine(coverage)}\n\n正文（按页标记）：\n${coverage?.text ?? pageText(pages, { maxChars: 45000 })}` : '（没有全文，只能依据标题与摘要）'}

我的研究关注点：${focus || '（未指定）'}

任务：粗读。只输出一个 JSON 对象：
{
  "oneLine": "一句话概括",
  "background": "研究背景与问题",
  "method": "核心方法与主要贡献",
  "results": "主要结果及适用条件",
  "figures": ["值得重点查看的图表或章节（写清图号与为什么）"],
  "limitations": "主要局限",
  "connection": "与我的研究的联系",
  "readDeeper": true,
  "questions": ["精读时应追问的问题"],
  "basis": "标题|摘要|全文",
  "evidence": [{"quote": "逐字原文", "page": 数字, "why": "支撑哪一节", "section": "background|method|results|figures|limitations|connection"}]
}
evidence 给 3-6 条，section 用给定枚举，指向它支撑的小节。如果没有全文，basis 必须写"摘要"，并在 limitations 说明缺少全文的影响。`,
  }
}

/** Deep read prompt. */
export function deepPrompt(item, pages, focus, coverage) {
  const hasFull = pages.length > 0
  return {
    system: DISCIPLINE,
    user: `${metaBlock(item)}

${hasFull ? `${coverageLine(coverage)}\n\n正文（按页标记）：\n${coverage?.text ?? pageText(pages, { maxChars: 60000 })}` : '（没有全文，只能依据标题与摘要）'}

我的研究关注点：${focus || '（未指定）'}

任务：精读。只输出一个 JSON 对象：
{
  "question": "研究问题与核心假设",
  "logic": "论证逻辑（前提→方法→结论）",
  "methodDetail": "方法细节及选择依据",
  "equations": [{"expression": "关键公式或描述", "variables": "变量与单位", "assumptions": "假设", "meaning": "意义"}],
  "figures": [{"label": "图/表编号", "what": "展示什么", "condition": "实验条件/对照", "takeaway": "结论"}],
  "evidenceQuality": "证据是否支持结论",
  "confounders": "混杂因素或替代解释",
  "authorLimitations": "作者承认的局限",
  "critique": "你的批判性意见（标为推断）",
  "reproduction": {"params": [], "equipment": [], "data": [], "code": [], "missing": []},
  "insights": ["对我的研究有用的启发"],
  "openQuestions": ["待验证问题"],
  "basis": "标题|摘要|全文",
  "evidence": [{"quote": "逐字原文", "page": 数字, "why": "支撑哪个判断", "section": "method|figures|evidence|confounders|limitations|critique"}]
}
evidence 给 5-8 条，优先给图表结论、方法关键句和局限。没有全文时必须在 methodDetail 与 figures 里说明无法核对。
长度约束：每个文字字段不超过 120 字；每个数组最多 6 项，每项不超过 40 字；整个 JSON 必须完整闭合。`,
  }
}

/** Follow-up Q&A prompt. */
export function askPrompt(item, pages, history, question) {
  const cover = coverPages(pages, { maxChars: 50000 })
  const provided = pages.length === 0
    ? '（没有全文，只能依据摘要）'
    : `本次提供正文：第 1–${cover.pagesRead} 页 / 共 ${pages.length} 页${cover.truncated ? `（第 ${cover.pagesRead + 1} 页起未提供，不要假设）` : ''}`
  const dialog = (history ?? [])
    .map((turn) => `${turn.role === 'user' ? '用户' : '助手'}：${turn.content}${turn.excerpt === true ? '（较早轮次的摘录；完整原文保存在插件中，未随本次发送）' : ''}`)
    .join('\n')
  const hasExcerpts = (history ?? []).some((turn) => turn.excerpt === true)
  return {
    system: `${DISCIPLINE.replace('输出严格 JSON，不要 Markdown 代码块，不要多余解释。', '用简洁的 Markdown 回答；引用原文时用 > 引用并标注 [[p.N]]。')}`,
    user: `${metaBlock(item)}

${pages.length > 0 ? `${provided}\n全文（按页标记）：\n${cover.text}` : provided}

${dialog ? `此前的对话：\n${dialog}\n` : ''}${hasExcerpts ? '注意：较早轮次只是摘录，不要编造摘录之外的内容；不确定时先说明。\n' : ''}
用户问题：${question}

要求：先给结论，再给依据；引用原文时标注页码（[[p.N]]），并保留文献 Zotero key；不要声称未提供的信息；无法核实时直说。`,
  }
}

/** Comparison prompt over several papers. */
export function comparePrompt(items, pagesByKey, fields, focus) {
  const corpus = items
    .map((item) => {
      const pages = pagesByKey[item.key] ?? []
      return `\n===== 文献 ${item.key} =====\n${metaBlock(item)}\n${pages.length > 0 ? pageText(pages, { maxChars: 18000 }) : '（无全文）'}`
    })
    .join('\n')
  return {
    system: DISCIPLINE,
    user: `以下是 ${items.length} 篇文献。我的关注点：${focus || '（未指定）'}

${corpus}

任务：按字段比较，只输出一个 JSON 对象：
{
  "fields": ${JSON.stringify(fields)},
  "rows": [{"key": "文献 key", "title": "标题", "cells": {"字段名": {"value": "内容", "comparable": true, "caveat": "指标/条件差异（若有）", "evidence": {"quote": "逐字原文", "page": 数字}}}}],
  "notes": "不可直接比较之处与原因"
}
规则：数值比较前核对定义、单位、数据集和条件；不可比时 comparable=false 并写 caveat。每个单元格尽量给一条证据。`,
  }
}

/** Theme organization prompt. */
export function themePrompt(items, collections, focus) {
  const list = items
    .map((item) => `- ${item.key} | ${String(item.title ?? '').slice(0, 140)} | ${(item.creators ?? []).slice(0, 2).join(', ')} | ${item.year || '?'} | 标签:${(item.tags ?? []).join('/') || '无'}`)
    .join('\n')
  return {
    system: DISCIPLINE,
    user: `现有集合：${collections.map((c) => c.name).join(' / ') || '（空）'}
我的研究关注点：${focus || '（未指定）'}

文献清单（key | 标题 | 作者 | 年份 | 标签）：
${list}

任务：依据标题、作者、年份与标签提出主题整理方案，优先沿用现有集合与标签习惯。你没有读过这些文献的全文，basedOn 只能写"标题"或"标签"，不要声称依据摘要或全文。只输出一个 JSON 对象：
{
  "themes": [{"name": "集合名", "kind": "主题|方法|对象|场景", "rationale": "为什么这样分", "basedOn": "标题|摘要|全文", "items": ["文献 key"]}],
  "tagPlan": [{"tag": "建议标签", "dimension": "主题|方法|对象|状态", "items": ["文献 key"]}],
  "duplicates": [{"keys": ["key1","key2"], "reason": "疑似重复的理由"}],
  "missingAttachments": [{"key": "文献 key", "reason": "没有 PDF 附件"}],
  "metadataIssues": [{"key": "文献 key", "issue": "缺失或异常字段"}]
}
不要建议删除条目或覆盖人工笔记。`,
  }
}

/** Relationship prompt. */
export function relationPrompt(items, pagesByKey, focus) {
  const corpus = items
    .map((item) => {
      const pages = pagesByKey[item.key] ?? []
      return `\n===== ${item.key} | ${item.title} =====\n${item.abstract || ''}\n${pages.length > 0 ? pageText(pages, { maxChars: 12000 }) : ''}`
    })
    .join('\n')
  return {
    system: DISCIPLINE,
    user: `围绕研究问题：${focus || '（未指定）'}，分析以下文献之间的关系。

${corpus}

任务：只输出一个 JSON 对象：
{
  "edges": [{"from": "key", "to": "key", "type": "method|support|conflict|similar|hypothesis", "reason": "理由", "basis": "全文|摘要|标题", "evidence": {"quote": "逐字原文", "page": 数字}}],
  "clusters": [{"name": "主题簇", "items": ["key"]}]
}
type 含义：method=方法继承或改进；support=支持某观点；conflict=冲突；similar=主题相似；hypothesis=AI 提出的待验证关联。
没有引用证据时不要声称"引用"关系；仅凭主题相似时必须用 similar。`,
  }
}

/** Pull the first JSON object out of a model answer. */
export function parseJson(text) {
  const trimmed = String(text ?? '').trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1))
      } catch {
        /* fall through */
      }
    }
    return undefined
  }
}


/**
 * Unified synthesis over the main analysis plus every supplemental batch.
 * The batches keep their own ranges; the synthesis must bind its claims to
 * the cumulative material actually read.
 */
export function synthesisPrompt(item, analysis, focus, cumulative) {
  const batches = [
    { label: '主分析', range: analysis.range, coverage: analysis.coverage, parsed: analysis.parsed, evidence: analysis.evidence },
    ...(analysis.supplements ?? []).map((supplement, index) => ({
      label: `补充 ${index + 1}`,
      range: supplement.range,
      coverage: supplement.coverage,
      parsed: supplement.parsed,
      evidence: supplement.evidence,
    })),
  ]
  const batchText = batches.map((batch) => {
    const parsed = batch.parsed ?? {}
    const fields = ['question', 'contribution', 'relevance', 'priority', 'reason', 'basis', 'methods', 'conditions', 'results', 'limitations', 'conflicts']
      .filter((field) => parsed[field] !== undefined && parsed[field] !== '')
      .map((field) => `${field}: ${typeof parsed[field] === 'string' ? parsed[field] : JSON.stringify(parsed[field])}`)
      .join('\n')
    const evidence = (batch.evidence ?? []).map((entry) => `- p.${entry.page ?? '?'} “${entry.quote ?? ''}”${entry.why ? `（支持：${entry.why}）` : ''}`).join('\n')
    return `### ${batch.label}（阅读范围 ${batch.coverage?.readFrom ?? '?'}–${batch.coverage?.readTo ?? '?'} 页，请求 ${batch.range ? batch.range.join('-') : '全篇'}）\n${fields}\n证据：\n${evidence || '（无）'}`
  }).join('\n\n')

  const system = [
    '你是严谨的科研阅读助手。你要把同一篇论文的多次分批阅读结果合并成一份统一综合结论。',
    '只使用下面提供的分批结论、证据和覆盖范围；不要补充未提供的内容。',
    '明确区分：作者陈述、你的推断、仍存疑的问题。数值保留单位、指标定义、数据集和实验条件。',
    '解决分批之间重复或矛盾的说法；矛盾未能解决的，写入 conflicts 并标注“仍存疑”。',
    '关键论断必须有原文证据（quote + page）。没有可靠依据的判断写入 uncertainties，或标为推断。',
    '只输出一个 JSON 对象，不要 Markdown 代码块。',
  ].join('\n')

  const user = [
    `文献：${item.title}`,
    `作者：${(item.creators ?? []).join(', ') || '未知'}`,
    `年份：${item.year || '未知'}`,
    `研究关注点：${focus || '未指定'}`,
    `累计阅读：${cumulative.readFrom ?? '?'}–${cumulative.readTo ?? '?'} 页 / 共 ${cumulative.pagesTotal} 页${cumulative.missing?.length ? `；未读 ${cumulative.missing.map(([a, b]) => (a === b ? `p.${a}` : `p.${a}–${b}`)).join('、')}` : '；已覆盖全文'}`,
    '',
    batchText,
    '',
    '输出 JSON：',
    '{"question":"统一后的研究问题","methods":"方法与材料","conditions":"实验条件/数据集/样本量","results":"主要结果（数值带单位）","limitations":"局限与不确定","relevance":"与研究关注点的关系","conflicts":[{"topic":"","batches":"哪几批","resolution":"如何解释","status":"已解决或仍存疑"}],"evidence":[{"quote":"原文","page":1,"why":"支持的论断"}],"uncertainties":["..."],"coverage":"本综合实际依据的材料范围"}',
  ].join('\n')

  return { system, user }
}
