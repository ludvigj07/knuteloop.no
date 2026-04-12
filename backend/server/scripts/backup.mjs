import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(APP_ROOT, 'server', 'data');
const UPLOADS_DIR = path.join(APP_ROOT, 'server', 'uploads');
const BACKUPS_DIR = path.join(APP_ROOT, 'server', 'backups');
const DB_FILE = path.join(DATA_DIR, 'app-db.json');

function createStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

const stamp = createStamp();
const targetDir = path.join(BACKUPS_DIR, stamp);
const targetDataDir = path.join(targetDir, 'data');
const targetUploadsDir = path.join(targetDir, 'uploads');

await fs.mkdir(targetDataDir, { recursive: true });

if (await exists(DB_FILE)) {
  await fs.copyFile(DB_FILE, path.join(targetDataDir, 'app-db.json'));
}

if (await exists(UPLOADS_DIR)) {
  await fs.cp(UPLOADS_DIR, targetUploadsDir, { recursive: true });
}

await fs.writeFile(
  path.join(targetDir, 'manifest.json'),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      dbIncluded: await exists(DB_FILE),
      uploadsIncluded: await exists(UPLOADS_DIR),
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Backup lagret i ${targetDir}`);
