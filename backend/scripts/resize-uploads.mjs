import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

const MAX_WIDTH = 1600;
const THUMB_WIDTH = 480;
const LARGE_QUALITY = 80;
const THUMB_QUALITY = 72;
const SIZE_THRESHOLD_BYTES = 500 * 1024;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function thumbPath(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  return path.join(dir, `${base}-thumb.webp`);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

async function main() {
  const entries = await fs.readdir(UPLOADS_DIR);
  let resized = 0;
  let thumbsCreated = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;

  for (const name of entries) {
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;
    if (name.endsWith(`-thumb.webp`)) continue;

    const filePath = path.join(UPLOADS_DIR, name);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;

    const meta = await sharp(filePath).metadata().catch(() => null);
    if (!meta) continue;

    const needsResize =
      (meta.width ?? 0) > MAX_WIDTH || stat.size > SIZE_THRESHOLD_BYTES;

    if (needsResize) {
      const buffer = await fs.readFile(filePath);
      const pipeline = sharp(buffer)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true });

      let encoded;
      if (ext === '.png') {
        encoded = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      } else if (ext === '.webp') {
        encoded = await pipeline.webp({ quality: LARGE_QUALITY }).toBuffer();
      } else {
        encoded = await pipeline.jpeg({ quality: LARGE_QUALITY, mozjpeg: true }).toBuffer();
      }

      if (encoded.length >= stat.size) {
        console.log(
          `skip ${name}: re-encode (${formatBytes(encoded.length)}) >= original (${formatBytes(stat.size)})`,
        );
      } else {
        bytesBefore += stat.size;
        await fs.writeFile(filePath, encoded);
        bytesAfter += encoded.length;
        resized += 1;
        console.log(
          `resize ${name}: ${formatBytes(stat.size)} -> ${formatBytes(encoded.length)}`,
        );
      }
    }

    const thumb = thumbPath(filePath);
    if (!(await exists(thumb))) {
      await sharp(filePath)
        .rotate()
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toFile(thumb);
      thumbsCreated += 1;
    }
  }

  console.log('---');
  console.log(`Resized images:  ${resized}`);
  console.log(`Thumbs created:  ${thumbsCreated}`);
  if (resized > 0) {
    console.log(
      `Before -> after: ${formatBytes(bytesBefore)} -> ${formatBytes(bytesAfter)}` +
        ` (-${formatBytes(bytesBefore - bytesAfter)})`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
