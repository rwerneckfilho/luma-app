import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const samplesPerAxis = 8;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function insideCircle(x, y, centerX, centerY, radius) {
  return (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2;
}

function generateIcon(size) {
  const scale = size / 96;
  const scanlines = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (1 + size * 4);
    scanlines[rowOffset] = 0;
    for (let x = 0; x < size; x += 1) {
      let visibleSamples = 0;
      for (let sampleY = 0; sampleY < samplesPerAxis; sampleY += 1) {
        for (let sampleX = 0; sampleX < samplesPerAxis; sampleX += 1) {
          const pointX = (x + (sampleX + 0.5) / samplesPerAxis) / scale;
          const pointY = (y + (sampleY + 0.5) / samplesPerAxis) / scale;
          const insideLargeCircle = insideCircle(pointX, pointY, 42, 48, 36);
          const insideSmallCutout = insideCircle(pointX, pointY, 66, 44.6, 18.3);
          const insideSmallDot = insideCircle(pointX, pointY, 66, 44.6, 14.3);
          if ((insideLargeCircle && !insideSmallCutout) || insideSmallDot) {
            visibleSamples += 1;
          }
        }
      }

      const pixelOffset = rowOffset + 1 + x * 4;
      scanlines[pixelOffset] = 255;
      scanlines[pixelOffset + 1] = 255;
      scanlines[pixelOffset + 2] = 255;
      scanlines[pixelOffset + 3] = Math.round(
        (visibleSamples / samplesPerAxis ** 2) * 255,
      );
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync(
  new URL("../assets/images/luma-notification-icon.png", import.meta.url),
  generateIcon(96),
);
writeFileSync(
  new URL("../assets/images/luma-monochrome-icon.png", import.meta.url),
  generateIcon(432),
);
