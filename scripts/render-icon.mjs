// Renders the app icon from the official DeepSeek whale path (assets/whale.svg):
// white full-bleed tile + the whale in the official blue gradient, then builds
// build/icon.icns via iconset + iconutil. Run with the project's Electron.
import { app, BrowserWindow } from 'electron'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = join(root, 'build')
mkdirSync(buildDir, { recursive: true })

const whaleSvg = readFileSync(join(root, 'assets', 'whale.svg'), 'utf8')
const pathMatch = whaleSvg.match(/<path\s+d="([^"]+)"/)
if (!pathMatch) {
  console.error('whale path not found in assets/whale.svg')
  process.exit(1)
}
const whalePath = pathMatch[1]

const SIZE = 1024
const WHALE_W = 640
const scale = WHALE_W / 23.16
const whaleH = 17.04 * scale
const x0 = (SIZE - WHALE_W) / 2
const y0 = (SIZE - whaleH) / 2

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:${SIZE}px;height:${SIZE}px;background:#fff}</style></head>
<body>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="whale-blue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6681FF"/>
      <stop offset="1" stop-color="#4767FF"/>
    </linearGradient>
  </defs>
  <g transform="translate(${x0} ${y0}) scale(${scale})">
    <path d="${whalePath}" fill="url(#whale-blue)"/>
  </g>
</svg>
</body></html>`

app.disableHardwareAcceleration()
console.error('step: waiting for ready')
await app.whenReady()
console.error('step: ready')
const win = new BrowserWindow({
  width: SIZE,
  height: SIZE,
  show: false,
  frame: false,
  webPreferences: { offscreen: false },
})
console.error('step: loading data url')
await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
console.error('step: loaded, settling')
await new Promise((resolve) => setTimeout(resolve, 800))
console.error('step: capturing')
const image = await win.webContents.capturePage()
const png = image.toPNG()
writeFileSync(join(buildDir, 'icon-1024.png'), png)
console.log(`captured ${image.getSize().width}x${image.getSize().height} -> build/icon-1024.png`)
console.error('step: done')
setTimeout(() => app.exit(0), 300)
