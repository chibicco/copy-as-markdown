// Generates the extension icons (a white "M↓" mark on an indigo rounded
// square) as PNGs using only Node built-ins, so the output is reproducible
// without image dependencies. Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const SIZES = [16, 48, 128]
const SUPERSAMPLE = 4
const CORNER_RADIUS = 0.19
const BG = [0x4f, 0x46, 0xe5, 0xff]
const FG = [0xff, 0xff, 0xff, 0xff]

// Glyph shapes in normalized [0,1] coordinates.
const M_POLY = [
  [0.14, 0.71], [0.14, 0.29], [0.26, 0.29], [0.37, 0.43], [0.48, 0.29],
  [0.6, 0.29], [0.6, 0.71], [0.48, 0.71], [0.48, 0.47], [0.37, 0.6],
  [0.26, 0.47], [0.26, 0.71],
]
const ARROW_SHAFT = [
  [0.765, 0.29], [0.845, 0.29], [0.845, 0.5], [0.765, 0.5],
]
const ARROW_HEAD = [
  [0.66, 0.5], [0.94, 0.5], [0.805, 0.71],
]
const GLYPHS = [M_POLY, ARROW_SHAFT, ARROW_HEAD]

function pointInPolygon(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function inRoundedSquare(x, y) {
  const r = CORNER_RADIUS
  const dx = Math.max(r - x, x - (1 - r), 0)
  const dy = Math.max(r - y, y - (1 - r), 0)
  return dx * dx + dy * dy <= r * r
}

function samplePixel(px, py, size, pad) {
  const acc = [0, 0, 0, 0]
  for (let sy = 0; sy < SUPERSAMPLE; sy++) {
    for (let sx = 0; sx < SUPERSAMPLE; sx++) {
      const x = ((px + (sx + 0.5) / SUPERSAMPLE) / size - pad) / (1 - 2 * pad)
      const y = ((py + (sy + 0.5) / SUPERSAMPLE) / size - pad) / (1 - 2 * pad)
      if (!inRoundedSquare(x, y)) continue
      const color = GLYPHS.some((poly) => pointInPolygon(x, y, poly)) ? FG : BG
      for (let c = 0; c < 4; c++) acc[c] += color[c]
    }
  }
  return acc.map((v) => Math.round(v / (SUPERSAMPLE * SUPERSAMPLE)))
}

function renderRGBA(size, pad = 0) {
  const rows = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4)
    rows[rowStart] = 0 // PNG filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = samplePixel(x, y, size, pad)
      rows.set([r, g, b, a], rowStart + 1 + x * 4)
    }
  }
  return rows
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encodePNG(size, rgbaRows) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rgbaRows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of SIZES) {
  const file = join(OUT_DIR, `icon-${size}.png`)
  writeFileSync(file, encodePNG(size, renderRGBA(size)))
  console.log(`wrote ${file}`)
}

// Chrome Web Store listing icon: 96x96 artwork centered in a 128x128
// canvas with a 16px transparent border, per the store image guidelines.
// Not shipped in the extension package, hence docs/ instead of public/.
const storeFile = join(OUT_DIR, '..', '..', 'docs', 'store-icon-128.png')
writeFileSync(storeFile, encodePNG(128, renderRGBA(128, 16 / 128)))
console.log(`wrote ${storeFile}`)
