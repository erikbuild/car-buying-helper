// ABOUTME: Draws the home-screen icons, a white check mark on a dark green square, as PNG files.
// ABOUTME: Run `node tools/make-icons.js` to write icon-192.png, icon-512.png and apple-touch-icon.png into site/icons.
import { mkdirSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const GREEN = [0x14, 0x53, 0x2d];
const WHITE = [0xff, 0xff, 0xff];
// The check mark's left tip, bottom corner and right tip, as fractions of the icon's side.
const CHECK_MARK = [[0.27, 0.51], [0.42, 0.66], [0.73, 0.34]];
const STROKE_WIDTH = 0.1;
const ICONS = [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function distanceToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const along = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + along * dx), y - (ay + along * dy));
}

// Returns the icon's RGB pixel rows, each led by PNG filter type 0 (none).
function drawIcon(size) {
  const [tip, corner, end] = CHECK_MARK.map(([x, y]) => [x * size, y * size]);
  const halfStroke = (STROKE_WIDTH * size) / 2;
  const rowLength = 1 + size * 3;
  const rows = Buffer.alloc(rowLength * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const centerX = x + 0.5;
      const centerY = y + 0.5;
      const distance = Math.min(
        distanceToSegment(centerX, centerY, tip, corner),
        distanceToSegment(centerX, centerY, corner, end),
      );
      // The share of the pixel the stroke covers, which smooths the stroke's edge.
      const coverage = Math.max(0, Math.min(1, halfStroke - distance + 0.5));
      for (let channel = 0; channel < 3; channel++) {
        const value = GREEN[channel] + (WHITE[channel] - GREEN[channel]) * coverage;
        rows[y * rowLength + 1 + x * 3 + channel] = Math.round(value);
      }
    }
  }
  return rows;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

function encodePng(size, rows) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); // width
  header.writeUInt32BE(size, 4); // height
  header[8] = 8; // bits per channel
  header[9] = 2; // color type RGB; compression, filter and interlace stay 0
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const iconsDir = new URL('../site/icons/', import.meta.url);
mkdirSync(iconsDir, { recursive: true });
for (const [file, size] of ICONS) {
  writeFileSync(new URL(file, iconsDir), encodePng(size, drawIcon(size)));
}
