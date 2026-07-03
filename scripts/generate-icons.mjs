// Generates the extension icons (a white clipboard with lowercase "md"
// overlapping it; where they overlap the fill is knocked out to the
// background color) as PNGs using only Node built-ins, so the output is
// reproducible without image dependencies. Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const SIZES = [16, 48, 128]
const SUPERSAMPLE = 4
const CORNER_RADIUS = 0.19
const BG = [0x18, 0x18, 0x1b, 0xff]
const FG = [0xff, 0xff, 0xff, 0xff]

// Shapes in normalized [0,1] coordinates. The letter stroke width:
const W = 0.07

function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1
}

function inRRect(x, y, x0, y0, x1, y1, r) {
  if (!inRect(x, y, x0, y0, x1, y1)) return false
  const dx = Math.max(x0 + r - x, x - (x1 - r), 0)
  const dy = Math.max(y0 + r - y, y - (y1 - r), 0)
  return dx * dx + dy * dy <= r * r
}

function inRoundedSquare(x, y) {
  return inRRect(x, y, 0, 0, 1, 1, CORNER_RADIUS)
}

// Clipboard drawn as an outline: board ring + solid clip tab at the top.
const S = 0.06 // outline stroke width

function inClipboard(x, y) {
  const board =
    inRRect(x, y, 0.14, 0.12, 0.86, 0.9, 0.09) &&
    !inRRect(x, y, 0.14 + S, 0.12 + S, 0.86 - S, 0.9 - S, 0.05)
  // Clip: wide tab over the board's top edge, with a slot hole like the
  // metal clip's handle.
  const tab =
    inRRect(x, y, 0.32, 0.04, 0.68, 0.24, 0.06) &&
    !inRRect(x, y, 0.4, 0.085, 0.6, 0.15, 0.03)
  return board || tab
}

// Lowercase geometric "md" centered on the board, scaled down a touch to
// leave breathing room inside the outline.
function inLetters(x, y) {
  const k = 0.85
  x = 0.5 + (x - 0.5) / k
  y = 0.57 + (y - 0.57) / k
  const m =
    inRect(x, y, 0.22, 0.42, 0.52, 0.42 + W) ||
    inRect(x, y, 0.22, 0.42, 0.22 + W, 0.72) ||
    inRect(x, y, 0.37 - W / 2, 0.42, 0.37 + W / 2, 0.72) ||
    inRect(x, y, 0.52 - W, 0.42, 0.52, 0.72)
  const d =
    inRect(x, y, 0.78 - W, 0.26, 0.78, 0.72) ||
    (inRect(x, y, 0.57, 0.42, 0.78, 0.72) &&
      !inRect(x, y, 0.57 + W, 0.42 + W, 0.78 - W, 0.72 - W))
  return m || d
}

function samplePixel(px, py, size, pad) {
  const acc = [0, 0, 0, 0]
  for (let sy = 0; sy < SUPERSAMPLE; sy++) {
    for (let sx = 0; sx < SUPERSAMPLE; sx++) {
      const x = ((px + (sx + 0.5) / SUPERSAMPLE) / size - pad) / (1 - 2 * pad)
      const y = ((py + (sy + 0.5) / SUPERSAMPLE) / size - pad) / (1 - 2 * pad)
      if (!inRoundedSquare(x, y)) continue
      // XOR: overlap between clipboard and letters knocks out to background.
      const color = inClipboard(x, y) !== inLetters(x, y) ? FG : BG
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
