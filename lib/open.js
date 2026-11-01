/**
 * Open a Zotero protocol URL on macOS, Windows or Linux without a shell.
 * Callers only pass URLs built inside this plugin from validated keys.
 */
import { spawn } from 'node:child_process'

export function zoteroOpenCommand(url, platform = process.platform) {
  if (typeof url !== 'string' || !url.startsWith('zotero://')) {
    throw new Error('只允许打开 zotero:// 协议 URL')
  }
  if (platform === 'darwin') return { command: 'open', args: ['-a', 'Zotero', url] }
  if (platform === 'win32') return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] }
  if (platform === 'linux') return { command: 'xdg-open', args: [url] }
  throw new Error(`不支持的平台：${platform}`)
}

export async function openZoteroUrl(url) {
  const { command, args } = zoteroOpenCommand(url)
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    let settled = false
    child.on('error', (error) => {
      if (settled) return
      settled = true
      reject(new Error(`无法启动 ${command}：${error.message}`))
    })
    child.on('exit', (code) => {
      if (settled) return
      settled = true
      if (code === 0) resolve()
      else reject(new Error(`${command} 退出码 ${code}`))
    })
  })
}
