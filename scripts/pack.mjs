/**
 * Cross-platform packaging: real `pnpm pack` for the npm tarball and a
 * whitelist-staged source tarball written by Node (no sh/cp/tar dependency).
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const pkgName = pkg.name
const out = process.argv[2] ?? root

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: root, stdio: 'inherit', ...options })
}

/** Prefer a real pnpm JS entry; on Windows never treat pnpm.cmd as a binary. */
function runPnpmPack() {
  const candidates = [process.env.DSH_PNPM, process.env.npm_execpath]
    .filter((entry) => typeof entry === 'string' && /pnpm/i.test(entry) && existsSync(entry))
  const bundled = join(homedir(), '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'pnpm', 'bin', 'pnpm.cjs')
  if (existsSync(bundled)) candidates.push(bundled)
  for (const entry of candidates) {
    run(process.execPath, [entry, 'pack'])
    return
  }
  if (process.platform === 'win32') {
    const found = spawnSync('where', ['pnpm.cmd'], { encoding: 'utf8' })
    if (found.status === 0 && found.stdout.trim() !== '') {
      const command = found.stdout.split(/\r?\n/)[0].trim()
      run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"${command}" pack`])
      return
    }
  } else {
    try { run('pnpm', ['pack']); return } catch { /* fall through */ }
  }
  throw new Error('找不到 pnpm：请安装 pnpm，或设置 DSH_PNPM 指向 pnpm.cjs；Harness 内置运行时位于 ~/.dsh/dsh-runtimes/<runtime>/dependencies/pnpm/bin/pnpm.cjs')
}

const FORBIDDEN = /(^|\/)(\.git|node_modules|storages|state\.json|analyses\.json|ask\.json|research\.json|\.env[^/]*|credentials[^/]*|.*\.credentials\.yaml|.*\.pem|.*\.key|.*\.pdf|.*\.caj|.*\.backup\.json|dsh-zotero-backup-.*\.json|dsh-zotero-research-backup-.*\.json|\.restore-[^/]*|.*\.tmp|.*\.tgz|.*\.tar\.gz)$/
function scan(dir) {
  const hits = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (FORBIDDEN.test(entry.name)) { hits.push(full); continue }
    if (entry.isDirectory()) hits.push(...scan(full))
  }
  return hits
}
// 1. client bundle
run(process.execPath, [join(root, 'client', 'build.mjs')])

// The install tarball is produced by pnpm from package.json "files". Scan every
// whitelisted input before packing so the same sensitive-file rules apply to
// both artifacts (not only the source stage).
const installInputs = []
for (const entry of pkg.files ?? []) {
  const full = join(root, entry)
  if (!existsSync(full)) continue
  if (statSync(full).isDirectory()) installInputs.push(...scan(full))
  else if (FORBIDDEN.test(basename(full))) installInputs.push(full)
}
if (installInputs.length > 0) { console.error('forbidden install files:', installInputs); process.exit(1) }

// 2. real npm-style tarball through pnpm pack
mkdirSync(out, { recursive: true })
rmSync(join(root, `${pkgName}-${version}.tgz`), { force: true })
runPnpmPack()
const installName = `${pkgName}-${version}.tgz`
if (!existsSync(join(root, installName))) throw new Error(`pnpm pack did not produce ${installName}`)
if (out !== root) {
  copyFileSync(join(root, installName), join(out, installName))
  rmSync(join(root, installName))
}

// 3. source package from an explicit whitelist
const stage = join(tmpdir(), `${pkgName}-source-${process.pid}`)
rmSync(stage, { recursive: true, force: true })
mkdirSync(join(stage, pkgName), { recursive: true })
const target = join(stage, pkgName)
const files = ['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', '.gitignore', 'cordis.patch.yml', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']
for (const file of files) cpSync(join(root, file), join(target, file))
for (const dir of ['lib', 'scripts', 'docs', 'examples', '.github', 'licenses']) cpSync(join(root, dir), join(target, dir), { recursive: true })
cpSync(join(root, 'client', 'src'), join(target, 'client', 'src'), { recursive: true })
cpSync(join(root, 'client', 'build.mjs'), join(target, 'client', 'build.mjs'))
mkdirSync(join(target, 'build'), { recursive: true })
cpSync(join(root, 'build', 'pdfkit-helper'), join(target, 'build', 'pdfkit-helper'))
cpSync(join(root, 'build', 'pdfkit-helper.json'), join(target, 'build', 'pdfkit-helper.json'))

const forbidden = scan(target)
if (forbidden.length > 0) { console.error('forbidden source files:', forbidden); process.exit(1) }

// 4. minimal ustar writer (cross-platform, deterministic order/mtime)
function header(name, size, mode, type) {
  const buffer = Buffer.alloc(512)
  const put = (value, offset, length) => buffer.write(value, offset, length, 'utf8')
  let namePart = name
  let prefix = ''
  if (Buffer.byteLength(name) > 100) {
    const cut = name.lastIndexOf('/')
    prefix = name.slice(0, cut)
    namePart = name.slice(cut + 1)
  }
  put(namePart.slice(0, 100), 0, 100)
  put(prefix.slice(0, 155), 345, 155)
  put(mode.toString(8).padStart(7, '0'), 100, 8)
  put('0000000', 108, 8)
  put('0000000', 116, 8)
  put(size.toString(8).padStart(11, '0'), 124, 12)
  put('1700000000', 136, 12)
  buffer.fill(32, 148, 156)
  buffer.write(type, 156, 1)
  put('ustar', 257, 6)
  put('00', 263, 2)
  let sum = 0
  for (const byte of buffer) sum += byte
  buffer.write(sum.toString(8).padStart(6, '0'), 148, 6)
  return buffer
}
function addEntry(path, name) {
  const info = statSync(path)
  if (info.isDirectory()) return [header(`${name}/`, 0, 0o755, '5')]
  const data = readFileSync(path)
  const head = header(name, data.length, info.mode & 0o777, '0')
  const parts = [head, data]
  const pad = (512 - (data.length % 512)) % 512
  if (pad > 0) parts.push(Buffer.alloc(pad))
  return parts
}
function walk(dir, base, parts) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name)
    const name = `${base}/${entry.name}`
    if (entry.isDirectory()) { parts.push(header(`${name}/`, 0, 0o755, '5')); walk(full, name, parts) }
    else parts.push(...addEntry(full, name))
  }
}
const parts = []
walk(target, pkgName, parts)
parts.push(Buffer.alloc(1024))
const tar = gzipSync(Buffer.concat(parts), { level: 9 })
const sourceName = `${pkgName}-${version}-source.tar.gz`
writeFileSync(join(out, sourceName), tar)
rmSync(stage, { recursive: true, force: true })

console.log(`install: ${join(out, installName)} (${statSync(join(out, installName)).size} bytes)`)
console.log(`source:  ${join(out, sourceName)} (${tar.length} bytes)`)
