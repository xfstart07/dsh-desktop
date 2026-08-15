// Whitens the near-white edge fringing (baked iOS rounded-corner AA) of the
// official DeepSeek app icon and writes build/icon-1024.png. The whale's blue
// gradient (r < 230) is untouched.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync, deflateSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const buf = readFileSync(join(root, 'assets', 'official-icon-1024.png'))

let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, idat = []
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos)
  const type = buf.toString('ascii', pos + 4, pos + 8)
  const data = buf.subarray(pos + 8, pos + 8 + len)
  if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9] }
  if (type === 'IDAT') idat.push(data)
  pos += 12 + len
}
if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
  console.error(`unsupported png: depth=${bitDepth} colorType=${colorType}`)
  process.exit(1)
}
const channels = colorType === 6 ? 4 : 3
const raw = inflateSync(Buffer.concat(idat))
const stride = width * channels
const px = Buffer.alloc(stride * height)
for (let y = 0; y < height; y++) {
  const f = raw[y * (stride + 1)]
  const row = y * stride
  const prev = (y - 1) * stride
  for (let x = 0; x < stride; x++) {
    const v = raw[y * (stride + 1) + 1 + x]
    const a = x >= channels ? px[row + x - channels] : 0
    const b = y > 0 ? px[prev + x] : 0
    const c = y > 0 && x >= channels ? px[prev + x - channels] : 0
    let out
    switch (f) {
      case 0: out = v; break
      case 1: out = v + a; break
      case 2: out = v + b; break
      case 3: out = v + ((a + b) >> 1); break
      default: { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) }
    }
    px[row + x] = out & 0xff
  }
}
const out = Buffer.alloc(stride * height)
for (let i = 0; i < px.length; i += channels) {
  const r = px[i], g = px[i + 1], b = px[i + 2]
  if (r >= 230 && g >= 230 && b >= 230) {
    out[i] = 255; out[i + 1] = 255; out[i + 2] = 255
    if (channels === 4) out[i + 3] = px[i + 3]
  } else {
    for (let c = 0; c < channels; c++) out[i + c] = px[i + c]
  }
}
// Re-encode (filter 0 rows).
const rawOut = Buffer.alloc((stride + 1) * height)
for (let y = 0; y < height; y++) {
  rawOut[y * (stride + 1)] = 0
  out.copy(rawOut, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
}
const crcTable = new Int32Array(256)
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c }
const crc32 = (b) => { let c = -1; for (const v of b) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0 }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = colorType
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rawOut)), chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(join(root, 'build', 'icon-1024.png'), png)
console.log(`whitened ${width}x${height} -> build/icon-1024.png`)
