/** Fetch and SSE helpers for the Zotero panel. */

const BASE = '/dsh-zotero'

export async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.headers ?? {}),
    },
  })
  const text = await response.text()
  let payload
  try {
    payload = text === '' ? undefined : JSON.parse(text)
  } catch {
    payload = text
  }
  if (!response.ok) {
    const error = new Error(payload?.error ?? `HTTP ${response.status}`)
    error.status = response.status
    error.code = payload?.code
    error.payload = payload
    throw error
  }
  return payload
}

/**
 * POST a JSON body and consume a text/event-stream response.
 * Returns an abort function.
 */
export function stream(path, body, handlers) {
  const controller = new AbortController()
  ;(async () => {
    try {
      const response = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok) {
        const text = await response.text()
        let message = `HTTP ${response.status}`
        try {
          message = JSON.parse(text).error ?? message
        } catch {
          /* keep default */
        }
        handlers.onError?.(new Error(message))
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          const event = block.match(/^event: (.+)$/m)?.[1] ?? 'message'
          const dataLine = block.match(/^data: (.+)$/m)?.[1] ?? ''
          let data
          try {
            data = JSON.parse(dataLine)
          } catch {
            data = dataLine
          }
          if (event === 'delta') handlers.onDelta?.(data.text ?? '')
          else if (event === 'start') handlers.onStart?.(data)
          else if (event === 'result') handlers.onResult?.(data)
          else if (event === 'error') handlers.onError?.(new Error(data.message ?? 'stream error'))
        }
      }
      handlers.onDone?.()
    } catch (error) {
      if (error?.name !== 'AbortError') handlers.onError?.(error)
    }
  })()
  return () => controller.abort()
}

/** Download a markdown export. */
export async function downloadExport(keys) {
  const response = await fetch(`${BASE}/export?keys=${encodeURIComponent(keys.join(','))}`)
  if (!response.ok) throw new Error(`导出失败：HTTP ${response.status}`)
  const text = await response.text()
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'zotero-export.md'
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Persistent UI preferences. */
export function readPref(key, fallback) {
  try {
    const raw = window.localStorage.getItem(`dsh-zotero:${key}`)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writePref(key, value) {
  try {
    window.localStorage.setItem(`dsh-zotero:${key}`, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}
