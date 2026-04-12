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
  return new Date()?.toISOString()?.replace(/[:.]/g, '-');
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function createSafetyBackup() {
  if (!(await exists(DB_FILE)) && !(await exists(UPLOADS_DIR))) {
    return null;
  }

  const stamp = `${createStamp()}-pre-reset`;
  const targetDir = path.join(BACKUPS_DIR, stamp);
  await fs.mkdir(path.join(targetDir, 'data'), { recursive: true });

  if (await exists(DB_FILE)) {
    await fs.copyFile(DB_FILE, path.join(targetDir, 'data', 'app-db.json'));
  }

  if (await exists(UPLOADS_DIR)) {
    await fs.cp(UPLOADS_DIR, path.join(targetDir, 'uploads'), { recursive: true });
  }

  return targetDir;
}

const backupPath = await createSafetyBackup();

await fs.rm(DB_FILE, { force: true });
await fs.rm(UPLOADS_DIR, { recursive: true, force: true });
await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(UPLOADS_DIR, { recursive: true });

if (backupPath) {
  console.log(`Eksisterende data ble sikkerhetskopiert til ${backupPath}`);
}

console.log('Pilotdata er nullstilt. Start serveren på nytt for å reseede app-db.json.');
