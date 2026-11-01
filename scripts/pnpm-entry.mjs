/** Resolve a pnpm shim (.CMD) to the real pnpm JS entry on Windows. */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

export function resolvePnpmJs(shimPath) {
  const dir = dirname(shimPath)
  const candidates = [
    join(dir, 'pnpm.cjs'),
    join(dir, 'pnpm.js'),
    join(dir, '..', 'pnpm', 'bin', 'pnpm.cjs'),
    join(dir, '..', '..', 'pnpm', 'bin', 'pnpm.cjs'),
    join(dir, '..', 'pnpm.cjs'),
  ]
  for (const candidate of candidates) if (existsSync(candidate)) return candidate
  try {
    const text = readFileSync(shimPath, 'utf8')
    const match = text.match(/[^\r\n"']*pnpm(?:\.cjs|\.js)/i)
    if (match !== null) {
      const raw = match[0].trim().replace(/^["']/, '')
      const expanded = raw
        .replace(/%~dp0/gi, `${dir}\\`)
        .replace(/%dp0%/gi, `${dir}\\`)
        .replace(/\//g, '\\')
      const full = normalize(expanded)
      if (existsSync(full)) return full
    }
  } catch {
    /* not a readable shim */
  }
  return undefined
}
