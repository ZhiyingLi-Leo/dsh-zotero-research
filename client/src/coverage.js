/** Cumulative page coverage across one analysis plus its supplements. */

export function readRangesOf(coverage) {
  if (!coverage || coverage.readFrom === null || coverage.readTo === null) return []
  return [[coverage.readFrom, coverage.readTo]]
}

export function cumulativeCoverage(analysis) {
  const total = analysis.coverage?.pagesTotal ?? 0
  const read = new Set()
  for (const range of [
    ...readRangesOf(analysis.coverage),
    ...(analysis.supplements ?? []).flatMap((supplement) => readRangesOf(supplement.coverage)),
  ]) {
    for (let page = range[0]; page <= range[1]; page += 1) read.add(page)
  }
  const missing = []
  let start = null
  for (let page = 1; page <= total; page += 1) {
    if (!read.has(page)) {
      if (start === null) start = page
    } else if (start !== null) {
      missing.push([start, page - 1])
      start = null
    }
  }
  if (start !== null) missing.push([start, total])
  const ranges = []
  let rangeStart = null
  for (let page = 1; page <= total; page += 1) {
    if (read.has(page)) {
      if (rangeStart === null) rangeStart = page
    } else if (rangeStart !== null) {
      ranges.push([rangeStart, page - 1])
      rangeStart = null
    }
  }
  if (rangeStart !== null) ranges.push([rangeStart, total])
  return { total, read: [...read].sort((a, b) => a - b), ranges, missing }
}

export function formatRanges(ranges) {
  return (ranges ?? []).map(([from, to]) => (from === to ? `p.${from}` : `p.${from}–${to}`)).join('，')
}
