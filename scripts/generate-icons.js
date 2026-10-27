import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Minimal pure-Node PNG generator using built-in zlib.
 * Draws the Bubble Level logo (dark slate background, glowing rings, emerald/cyan bubble).
 */
function createPngIcon(size, filename) {
  const width = size;
  const height = size;
  const buffer = Buffer.alloc(width * height * 4);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width * 0.44;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.hypot(dx, dy);

      // App background: rounded rect or circular dark background
      if (dist <= radius) {
        // Dark background #0d131f
        let r = 13, g = 19, b = 31, a = 255;

        // Outer ring (dist around radius * 0.88)
        if (Math.abs(dist - radius * 0.88) < (size > 256 ? 3 : 2)) {
          r = 56; g = 189; b = 248; a = 120; // Cyan accent
        }
        // Middle ring (dist around radius * 0.55)
        else if (Math.abs(dist - radius * 0.55) < (size > 256 ? 3 : 2)) {
          r = 255; g = 255; b = 255; a = 90;
        }
        // Inner ring (dist around radius * 0.28)
        else if (Math.abs(dist - radius * 0.28) < (size > 256 ? 3 : 2)) {
          r = 16; g = 185; b = 129; a = 180; // Emerald
        }

        // Crosshairs
        if ((Math.abs(dx) < (size > 256 ? 2 : 1) && dist < radius * 0.9) ||
            (Math.abs(dy) < (size > 256 ? 2 : 1) && dist < radius * 0.9)) {
          r = 255; g = 255; b = 255; a = 60;
        }

        // The bubble in the center (dist < radius * 0.22)
        if (dist <= radius * 0.22) {
          // Emerald glowing bubble gradient
          const bubbleRatio = dist / (radius * 0.22);
          r = Math.round(16 + (167 - 16) * (1 - bubbleRatio * 0.7));
          g = Math.round(185 + (243 - 185) * (1 - bubbleRatio * 0.7));
          b = Math.round(129 + (208 - 129) * (1 - bubbleRatio * 0.7));
          a = 255;

          // Glare reflection top-left
          const glareDist = Math.hypot(dx + radius * 0.07, dy + radius * 0.07);
          if (glareDist < radius * 0.06) {
            r = 255; g = 255; b = 255; a = 240;
          }
        }

        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = a;
      } else {
        // Transparent outside
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  // Format PNG
  const rowSize = width * 4;
  const rawData = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (rowSize + 1)] = 0; // Filter: None
    buffer.copy(rawData, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG chunks
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const chunkType = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([chunkType, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, chunkType, data, crcBuf]);
  }

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  fs.writeFileSync(filename, png);
  console.log(`Generated icon: ${filename} (${width}x${height}, ${png.length} bytes)`);
}

// CRC32 table & function
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const iconsDir = path.resolve('icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

createPngIcon(192, path.join(iconsDir, 'icon-192.png'));
createPngIcon(512, path.join(iconsDir, 'icon-512.png'));
createPngIcon(180, path.join(iconsDir, 'apple-touch-icon.png'));
console.log('All icons generated successfully!');
