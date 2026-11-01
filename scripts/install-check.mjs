/**
 * Install the just-packed tarball into a throwaway Node project with install
 * scripts disabled, then verify the installed package is complete and that its
 * pdfjs-dist runtime dependency resolves. Works on macOS/Windows/Linux.
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}
let tgz = option('--tgz')
if (tgz === undefined) {
  const files = (await readdir(root)).filter((name) => name === `${pkg.name}-${pkg.version}.tgz`)
  assert.equal(files.length, 1, `expected ${pkg.name}-${pkg.version}.tgz; run scripts/pack.mjs first`)
  tgz = join(root, files[0])
}
const pnpmJs = option('--pm-js')

const dir = await mkdtemp(join(tmpdir(), `${pkg.name}-install-check-`))
try {
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'install-check', private: true }))
  if (pnpmJs !== undefined) {
    execFileSync(process.execPath, [pnpmJs, 'add', '--ignore-scripts', tgz], { cwd: dir, stdio: 'inherit' })
  } else {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    execFileSync(command, ['install', '--ignore-scripts', '--no-audit', '--no-fund', tgz], {
      cwd: dir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
  }

  const installed = join(dir, 'node_modules', pkg.name)
  const installedPkg = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'))
  assert.equal(installedPkg.name, pkg.name, 'installed package name')
  assert.equal(installedPkg.version, pkg.version, 'installed package version')
  assert.ok(installedPkg.dependencies?.['pdfjs-dist'] !== undefined, 'pdfjs-dist is a runtime dependency')

  const host = await import(pathToFileURL(join(installed, 'lib', 'index.js')).href)
  assert.equal(host.name, pkg.name, 'installed host export name')
  assert.ok(host.inject.includes('tools') && host.inject.includes('sessionPersistence'), 'installed host inject list')

  const patch = await readFile(join(installed, 'cordis.patch.yml'), 'utf8')
  assert.ok(patch.includes(`id: ${pkg.name}`), 'installed patch id')
  assert.ok(patch.includes(`name: '${pkg.name}'`), 'installed patch name')

  const clientPath = join(installed, 'client', 'client.js')
  assert.ok(existsSync(clientPath), 'installed client bundle exists')
  const client = await readFile(clientPath, 'utf8')
  assert.ok(client.includes(`id: '${pkg.name}'`), 'installed client loader id')
  assert.ok(client.includes(`var BASE = "/${pkg.name}"`), 'installed client API base')

  const realInstalled = await realpath(installed)
  const requireFromPackage = createRequire(join(realInstalled, 'package.json'))
  const pdfjsPkgPath = requireFromPackage.resolve('pdfjs-dist/package.json')
  const pdfjsPkg = JSON.parse(await readFile(pdfjsPkgPath, 'utf8'))
  assert.equal(pdfjsPkg.name, 'pdfjs-dist', 'resolved pdfjs-dist package')
  assert.ok(existsSync(join(dirname(pdfjsPkgPath), 'legacy', 'build', 'pdf.mjs')), 'pdfjs-dist legacy text build is installed')
  console.log(`install-check passed: ${pkg.name}@${pkg.version}, pdfjs-dist ${pdfjsPkg.version}, scripts disabled`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
