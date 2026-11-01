/**
 * Zotero local API client.
 *
 * Talks to the local API Zotero exposes on 127.0.0.1:23119 (`/api/users/0`).
 * Reads need no auth. Writes need a local API key obtained through
 * POST /api/local/authorize (Zotero shows a modal) and the Zotero-Server-ID
 * header on every write.
 *
 * @module dsh-zotero/zotero
 */
import { fileURLToPath } from 'node:url'

const DEFAULT_BASE = 'http://127.0.0.1:23119'

/** Error carrying the HTTP status and Zotero's message. */
export class ZoteroError extends Error {
  constructor(status, message, body) {
    super(message)
    this.name = 'ZoteroError'
    this.status = status
    this.body = body
  }
}

/** One Zotero HTTP client. */
export class ZoteroClient {
  constructor({ baseUrl = DEFAULT_BASE } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.serverId = undefined
    this.apiKey = undefined
  }

  /** Enable writes with a previously authorized key. */
  setApiKey(key) {
    this.apiKey = typeof key === 'string' && key.length > 0 ? key : undefined
  }

  /** Remember the instance id from any response. */
  observe(response) {
    const id = response.headers.get('zotero-server-id')
    if (id !== null && id.length > 0) this.serverId = id
  }

  /** Read a fresh server id (needed before an authorize POST). */
  async refreshServerId() {
    const response = await fetch(`${this.baseUrl}/api/users/0/items?limit=1`, {
      headers: { 'Zotero-API-Version': '3' },
    })
    this.observe(response)
    await response.arrayBuffer()
    return this.serverId
  }

  /**
   * One API request.
   * @param path - path below /api/users/0 (leading slash).
   * @param options - method, body, headers, raw.
   */
  async request(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
    const upper = method.toUpperCase()
    const write = upper !== 'GET' && upper !== 'HEAD'
    const finalHeaders = {
      'Zotero-API-Version': '3',
      ...headers,
    }
    if (body !== undefined && !raw) finalHeaders['content-type'] = 'application/json'
    if (write) {
      if (this.serverId === undefined) await this.refreshServerId()
      if (this.serverId !== undefined) finalHeaders['Zotero-Server-ID'] = this.serverId
      if (this.apiKey !== undefined) finalHeaders['Zotero-API-Key'] = this.apiKey
    }
    const response = await fetch(`${this.baseUrl}/api/users/0${path}`, {
      method: upper,
      headers: finalHeaders,
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      redirect: 'manual',
    })
    this.observe(response)
    if (response.status === 302) {
      return { redirect: response.headers.get('location') }
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new ZoteroError(response.status, text.trim() || response.statusText, text)
    }
    if (raw) return response
    const text = await response.text()
    if (text.length === 0) return undefined
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  /** Ask Zotero to show the authorization modal. Resolves with {key, remember}. */
  async authorize(appName = 'DeepSeek Harness') {
    if (this.serverId === undefined) await this.refreshServerId()
    const response = await fetch(`${this.baseUrl}/api/local/authorize`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.serverId === undefined ? {} : { 'Zotero-Server-ID': this.serverId }),
      },
      body: JSON.stringify({ appName }),
    })
    this.observe(response)
    const text = await response.text()
    if (!response.ok) throw new ZoteroError(response.status, text.trim() || response.statusText, text)
    return JSON.parse(text)
  }

  /** Liveness + instance facts. */
  async status() {
    const response = await fetch(`${this.baseUrl}/api/users/0/items?limit=1`, {
      headers: { 'Zotero-API-Version': '3' },
    })
    this.observe(response)
    await response.arrayBuffer()
    if (!response.ok) throw new ZoteroError(response.status, response.statusText)
    return {
      reachable: true,
      serverId: this.serverId,
      version: response.headers.get('x-zotero-version') ?? null,
      schemaVersion: response.headers.get('zotero-schema-version') ?? null,
      writeKey: this.apiKey !== undefined,
    }
  }

  async listCollections() {
    return this.request('/collections?limit=100')
  }

  /** Count papers, attachments, notes and annotations in one pass. */
  async counts() {
    const all = []
    for (let start = 0; ; start += 100) {
      const page = await this.request(`/items?limit=100&start=${start}`)
      all.push(...page)
      if (page.length < 100) break
    }
    const counts = { total: all.length, papers: 0, attachments: 0, notes: 0, annotations: 0 }
    for (const entry of all) {
      const type = entry.data?.itemType
      if (type === 'attachment') counts.attachments += 1
      else if (type === 'note') counts.notes += 1
      else if (type === 'annotation') counts.annotations += 1
      else counts.papers += 1
    }
    return counts
  }

  /** Total item count from the API's Total-Results header. */
  async countItems() {
    const response = await fetch(`${this.baseUrl}/api/users/0/items?limit=1`, {
      headers: { 'Zotero-API-Version': '3' },
    })
    this.observe(response)
    await response.arrayBuffer()
    const total = response.headers.get('total-results')
    return total === null ? null : Number(total)
  }

  async listItems({ collection, q, limit = 200, sort = 'dateAdded', direction = 'desc', type } = {}) {
    const params = new URLSearchParams({ limit: String(limit), sort, direction })
    if (q) params.set('q', q)
    if (type) params.set('itemType', type)
    // The local API ignores `?collection=` on /items; scope by the collection's
    // own item list instead.
    const base = collection ? `/collections/${encodeURIComponent(collection)}/items` : '/items'
    return this.request(`${base}?${params.toString()}`)
  }

  async getCollection(key) {
    return this.request(`/collections/${encodeURIComponent(key)}`)
  }

  async getItem(key) {
    return this.request(`/items/${encodeURIComponent(key)}`)
  }

  async getChildren(key) {
    return this.request(`/items/${encodeURIComponent(key)}/children?limit=100`)
  }

  /** Annotations are only listed when the child request asks for that type. */
  async listAnnotations(attachmentKey) {
    return this.request(`/items/${encodeURIComponent(attachmentKey)}/children?itemType=annotation&limit=100`)
  }

  async getFulltext(attachmentKey) {
    return this.request(`/items/${encodeURIComponent(attachmentKey)}/fulltext`)
  }

  /** Resolve an attachment's local file path through the API's 302 redirect. */
  async attachmentPath(attachmentKey) {
    const result = await this.request(`/items/${encodeURIComponent(attachmentKey)}/file`)
    if (result === undefined || result.redirect === undefined) return undefined
    const url = result.redirect
    if (!url.startsWith('file://')) return undefined
    return fileURLToPath(url)
  }

  async createNote({ parentItem, note, tags = [] }) {
    const payload = [
      {
        itemType: 'note',
        parentItem,
        note,
        tags: tags.map((tag) => ({ tag })),
      },
    ]
    return this.request('/items', { method: 'POST', body: payload })
  }

  async updateNote({ key, note, tags = [], version }) {
    const payload = {
      key,
      version,
      itemType: 'note',
      note,
      tags: tags.map((tag) => ({ tag })),
    }
    return this.request(`/items/${encodeURIComponent(key)}`, { method: 'PATCH', body: payload })
  }

  async createAnnotation({ parentItem, page, rects, text, comment = '', color = '#ffd400', pageLabel = '', pageHeight, pageOriginY = 0, pageRotation = 0, charOffset = 0 }) {
    const sortIndex = formatAnnotationSortIndex({ page, rect: rects[0], pageHeight, pageOriginY, pageRotation, charOffset })
    const body = [
      {
        itemType: 'annotation',
        parentItem,
        annotationType: 'highlight',
        annotationText: text,
        annotationComment: comment,
        annotationColor: color,
        annotationPageLabel: String(pageLabel || ''),
        annotationSortIndex: sortIndex,
        annotationPosition: JSON.stringify({ pageIndex: page, rects }),
      },
    ]
    return this.request('/items', { method: 'POST', body })
  }

  async createCollection({ name, parentCollection }) {
    const body = [{ name, ...(parentCollection ? { parentCollection } : {}) }]
    return this.request('/collections', { method: 'POST', body })
  }

  async addToCollection({ itemKey, collectionKey }) {
    const item = await this.getItem(itemKey)
    const data = Array.isArray(item) ? item[0] : item
    const collections = new Set(data.data.collections ?? [])
    if (collections.has(collectionKey)) return { changed: false }
    collections.add(collectionKey)
    return this.request(`/items/${encodeURIComponent(itemKey)}`, {
      method: 'PATCH',
      body: { key: itemKey, version: data.version, collections: [...collections] },
    })
  }

  async removeFromCollection({ itemKey, collectionKey }) {
    const item = await this.getItem(itemKey)
    const data = Array.isArray(item) ? item[0] : item
    const collections = (data.data.collections ?? []).filter((id) => id !== collectionKey)
    return this.request(`/items/${encodeURIComponent(itemKey)}`, {
      method: 'PATCH',
      body: { key: itemKey, version: data.version, collections },
    })
  }
}

/** Resolve the first PDF attachment among an item's children. */
export function pdfChild(children) {
  for (const child of children ?? []) {
    const data = child.data ?? {}
    if (data.itemType !== 'attachment') continue
    if (data.contentType === 'application/pdf' || /\.pdf$/i.test(data.filename ?? '')) return child
  }
  return undefined
}

/** Normalize an item record from the API. */
export function itemSummary(entry) {
  const d = entry.data ?? entry
  const creators = (d.creators ?? []).map((c) => c.lastName || c.name || '').filter(Boolean)
  const year = (d.date ?? '').match(/\d{4}/)?.[0] ?? ''
  return {
    key: entry.key ?? d.key,
    version: entry.version,
    itemType: d.itemType,
    title: d.title ?? d.note?.slice(0, 80) ?? '(无标题)',
    creators,
    year,
    date: d.date ?? '',
    publication: d.publicationTitle ?? d.bookTitle ?? d.proceedingsTitle ?? d.publisher ?? '',
    doi: d.DOI ?? '',
    url: d.url ?? '',
    abstract: d.abstractNote ?? '',
    tags: (d.tags ?? []).map((t) => t.tag),
    collections: d.collections ?? [],
    dateAdded: d.dateAdded ?? '',
    dateModified: d.dateModified ?? '',
  }
}


/**
 * Zotero reader sort index: 5-digit 1-based page | 6-digit char offset | 5-digit
 * distance from the PDF page top. Rect coordinates are PDF space (y-up), so the
 * top is rect[3] and the distance is page top minus that value. Rotated pages or
 * missing page geometry use offset 0 rather than inventing a precise position.
 */
export function formatAnnotationSortIndex({ page, rect, pageHeight, pageOriginY = 0, pageRotation = 0, charOffset = 0 }) {
  // Official selection.js passes position.pageIndex (0-based) directly.
  const pageIndex = Math.max(0, Math.floor(Number(page) || 0))
  const offset = Math.max(0, Math.min(999999, Math.round(Number(charOffset) || 0)))
  let distance = 0
  const top = Array.isArray(rect) ? Number(rect[3]) : NaN
  if (pageRotation === 0 && Number.isFinite(pageHeight) && Number.isFinite(top)) {
    distance = Math.floor(pageOriginY + pageHeight - top)
    if (!Number.isFinite(distance)) distance = 0
    distance = Math.max(0, Math.min(99999, distance))
  }
  return `${String(pageIndex).padStart(5, '0')}|${String(offset).padStart(6, '0')}|${String(distance).padStart(5, '0')}`
}
