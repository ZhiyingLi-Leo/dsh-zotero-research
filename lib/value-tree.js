/**
 * Shared readable value tree for reader sections and Markdown export.
 * Unknown fields are preserved with their raw key as the label.
 */
export const FIELD_LABELS = {
  expression: '表达式',
  variables: '变量与单位',
  assumptions: '假设',
  meaning: '意义',
  label: '编号',
  what: '内容',
  condition: '条件/对照',
  takeaway: '结论',
  params: '参数',
  equipment: '设备',
  data: '数据',
  code: '代码',
  missing: '缺失',
  question: '研究问题',
  hypothesis: '假设',
  contribution: '主要贡献',
  relevance: '相关性',
  priority: '优先级',
  reason: '理由',
  oneLine: '一句话概括',
  background: '背景与问题',
  method: '方法',
  methodDetail: '方法细节',
  results: '结果',
  figures: '图表',
  limitations: '局限',
  connection: '与研究的关系',
  questions: '待追问',
  logic: '论证逻辑',
  equations: '关键公式',
  evidenceQuality: '证据质量',
  confounders: '混杂因素',
  authorLimitations: '作者局限',
  critique: '批判性意见',
  reproduction: '复现所需',
  insights: '启发',
  openQuestions: '待验证问题',
  basis: '依据',
  evidence: '证据',
}

export function labelFor(key) {
  return FIELD_LABELS[key] ?? String(key)
}

const MAX_ITEMS = 100
const MAX_DEPTH = 6

/** Convert any JSON value into a depth-limited tree with readable labels. */
export function toValueTree(value, depth = 0) {
  if (value === null || value === undefined) return { kind: 'scalar', text: '（未说明）' }
  if (typeof value === 'string') return { kind: 'scalar', text: value }
  if (typeof value === 'number' || typeof value === 'boolean') return { kind: 'scalar', text: String(value) }
  if (depth >= MAX_DEPTH) return { kind: 'scalar', text: '（层级过深）' }
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((item) => toValueTree(item, depth + 1))
    if (value.length > MAX_ITEMS) items.push({ kind: 'scalar', text: `…另有 ${value.length - MAX_ITEMS} 项` })
    return { kind: 'array', items }
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).slice(0, MAX_ITEMS).map(([key, child]) => ({
      key,
      label: labelFor(key),
      tree: toValueTree(child, depth + 1),
    }))
    return { kind: Object.hasOwn(value, 'expression') ? 'equation' : 'object', entries }
  }
  return { kind: 'scalar', text: String(value) }
}
