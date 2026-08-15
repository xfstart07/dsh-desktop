// Generates a placeholder app icon: build/icon.icns (1024px PNG → iconset → icns).
import { deflateSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const buildDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'build')
mkdirSync(buildDir, { recursive: true })

const crcTable = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}
function crc32(buf) {
  let c = -1
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const S = 1024
const px = Buffer.alloc(S * S * 4)
const corner = 190
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4
    const qx = Math.max(corner - x, x - (S - 1 - corner), 0)
    const qy = Math.max(corner - y, y - (S - 1 - corner), 0)
    const inside = qx * qx + qy * qy <= corner * corner
    if (!inside) continue
    const t = y / S
    px[i] = Math.round(0x3e + (0x16 - 0x3e) * t)
    px[i + 1] = Math.round(0x63 + (0x25 - 0x63) * t)
    px[i + 2] = Math.round(0xdd + (0x5c - 0xdd) * t)
    px[i + 3] = 255
  }
}
const bars = [
  { cx: 0.5, cy: 0.36, w: 0.46, h: 0.085, r: 0.042 },
  { cx: 0.5, cy: 0.5, w: 0.34, h: 0.085, r: 0.042 },
  { cx: 0.5, cy: 0.64, w: 0.46, h: 0.085, r: 0.042 },
]
for (const bar of bars) {
  const x0 = (bar.cx - bar.w / 2) * S
  const x1 = (bar.cx + bar.w / 2) * S
  const y0 = (bar.cy - bar.h / 2) * S
  const y1 = (bar.cy + bar.h / 2) * S
  const rr = bar.r * S
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      if (x < 0 || y < 0 || x >= S || y >= S) continue
      const dx = Math.max(x0 + rr - x, x - (x1 - rr), 0)
      const dy = Math.max(y0 + rr - y, y - (y1 - rr), 0)
      if (dx * dx + dy * dy <= rr * rr) {
        const i = (y * S + x) * 4
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255
      }
    }
  }
}

const pngPath = join(buildDir, 'icon-1024.png')
writeFileSync(pngPath, encodePng(S, px))

const iconset = join(buildDir, 'icon.iconset')
rmSync(iconset, { recursive: true, force: true })
mkdirSync(iconset)
const sizes = [
  ['icon_16x16.png', 16], ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32], ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128], ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256], ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512], ['icon_512x512@2x.png', 1024],
]
for (const [name, size] of sizes) {
  execFileSync('sips', ['-z', String(size), String(size), pngPath, '--out', join(iconset, name)], { stdio: 'ignore' })
}
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(buildDir, 'icon.icns')], { stdio: 'ignore' })
console.log('icon written to build/icon.icns')
