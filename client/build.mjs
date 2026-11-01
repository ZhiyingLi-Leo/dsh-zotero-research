import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const out = await build({
  entryPoints: ['client/src/index.jsx'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  jsxImportSource: 'react',
  external: ['react', 'react-dom', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'],
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  logLevel: 'info',
})

const code = out.outputFiles[0].text
const wrapped = `window.__ModuleLoader__.load({\n  id: 'dsh-zotero',\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n${code}\n    return module.exports;\n  },\n});\n`
await mkdir('client', { recursive: true })
await writeFile('client/client.js', wrapped)
console.log(`client/client.js written (${(wrapped.length / 1024).toFixed(1)} KiB)`)
