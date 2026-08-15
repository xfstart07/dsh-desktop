// DeepSeek Harness — Electron main process.
// Spawns the dsh web backend on Electron's own Node (ELECTRON_RUN_AS_NODE), loads
// the GUI it serves over loopback, and owns the backend's lifecycle.
import { app, BrowserWindow, dialog, shell } from 'electron'
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PRODUCT_NAME = 'DeepSeek Harness'
const BACKEND_BOOT_TIMEOUT_MS = 30_000
const BACKEND_KILL_GRACE_MS = 5_000

app.setName(PRODUCT_NAME)

const resourcesDir = app.isPackaged ? process.resourcesPath : join(import.meta.dirname, '..')
const backendBin = join(resourcesDir, 'backend', 'lib', 'bin.js')

const logDir = app.getPath('logs')
mkdirSync(logDir, { recursive: true })
const logStream = createWriteStream(join(logDir, 'backend.log'), { flags: 'a' })
function tee(stream, tag) {
  stream.on('data', (chunk) => logStream.write(`[${tag}] ${chunk}`))
}

const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
function hasApiKey() {
  if (process.env.DEEPSEEK_API_KEY) return true
  const creds = join(dshHome, '.credentials.yaml')
  if (!existsSync(creds)) return false
  return /DEEPSEEK_API_KEY\s*:/.test(readFileSync(creds, 'utf8'))
}
function warnMissingKey() {
  const creds = join(dshHome, '.credentials.yaml')
  const target = existsSync(creds) ? creds : dshHome
  const choice = dialog.showMessageBoxSync({
    type: 'warning',
    message: '未找到可用的 DEEPSEEK_API_KEY',
    detail: `后端将无法发起模型请求。请在 ${creds} 中添加 DEEPSEEK_API_KEY（或设置环境变量）后重启本应用。`,
    buttons: ['打开配置位置', '继续启动'],
    defaultId: 0,
  })
  if (choice === 0) shell.openPath(target)
}

let backend = null
let backendUrl = null
let quitting = false

function startBackend() {
  return new Promise((resolve, reject) => {
    backend = spawn(process.execPath, ['--expose-internals', backendBin, 'web', '--port', '0'], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let buffer = ''
    backend.stdout.on('data', (chunk) => {
      buffer += chunk
      const match = buffer.match(/dsh web: (https?:\/\/\S+)/)
      if (match && backendUrl === null) {
        backendUrl = match[1]
        resolve(backendUrl)
      }
    })
    tee(backend.stdout, 'backend:out')
    tee(backend.stderr, 'backend:err')
    backend.on('error', (err) => reject(err))
    backend.on('exit', (code, signal) => {
      if (quitting) return
      dialog.showErrorBox(
        '后端意外退出',
        `dsh web 进程退出（code=${code} signal=${signal}）。日志：${join(logDir, 'backend.log')}`,
      )
      reject(new Error(`backend exited code=${code} signal=${signal}`))
    })
    setTimeout(() => reject(new Error('backend boot timeout')), BACKEND_BOOT_TIMEOUT_MS).unref()
  })
}

function stopBackend() {
  if (backend === null || backend.exitCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { backend.kill('SIGKILL') } catch { /* already gone */ }
    }, BACKEND_KILL_GRACE_MS)
    backend.once('exit', () => { clearTimeout(timer); resolve() })
    try { backend.kill('SIGTERM') } catch { clearTimeout(timer); resolve() }
  })
}

let win = null
function createWindow(url) {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    title: PRODUCT_NAME,
    backgroundColor: '#0d1117',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/.test(target)) shell.openExternal(target)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(backendUrl)) {
      event.preventDefault()
      if (/^https?:/.test(target)) shell.openExternal(target)
    }
  })
  win.once('ready-to-show', () => win.show())
  win.loadURL(url)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win !== null) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', (event) => {
    if (quitting) return
    quitting = true
    if (backend !== null && backend.exitCode === null) {
      event.preventDefault()
      stopBackend().finally(() => app.quit())
    }
  })
  process.on('SIGTERM', () => {
    quitting = true
    stopBackend().finally(() => app.exit(0))
  })

  app.whenReady().then(async () => {
    if (!existsSync(backendBin)) {
      dialog.showErrorBox('后端缺失', `未找到 ${backendBin}。请先运行 npm run backend:deploy。`)
      app.quit()
      return
    }
    if (!hasApiKey()) warnMissingKey()
    try {
      const url = await startBackend()
      createWindow(url)
    } catch (err) {
      if (!quitting) {
        dialog.showErrorBox('启动失败', String(err))
        app.quit()
      }
    }
  })
}
