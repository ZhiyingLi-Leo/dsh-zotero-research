/** A small, safe Markdown renderer for model answers (no raw HTML). */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function renderMarkdown(markdown) {
  const lines = escapeHtml(markdown ?? '').split(/\r?\n/)
  const out = []
  let inList = false
  let inCode = false
  const closeList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }
  for (const raw of lines) {
    const line = raw
    if (line.trim().startsWith('```')) {
      closeList()
      if (inCode) {
        out.push('</code></pre>')
        inCode = false
      } else {
        out.push('<pre><code>')
        inCode = true
      }
      continue
    }
    if (inCode) {
      out.push(line)
      continue
    }
    if (line.trim() === '') {
      closeList()
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      closeList()
      out.push(`<h${heading[1].length + 2}>${inline(heading[2])}</h${heading[1].length + 2}>`)
      continue
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${inline(bullet[1])}</li>`)
      continue
    }
    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      closeList()
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`)
      continue
    }
    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  if (inCode) out.push('</code></pre>')
  return out.join('\n')
}

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
}
