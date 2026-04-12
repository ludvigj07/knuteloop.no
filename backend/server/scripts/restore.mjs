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

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveBackupDir(requestedName) {
  if (requestedName) {
    return path.join(BACKUPS_DIR, requestedName);
  }

  const entries = await fs.readdir(BACKUPS_DIR, { withFileTypes: true });
  const directories = entries?.filter((entry) => entry?.isDirectory())?.map((entry) => entry?.name);

  if (directories?.length === 0) {
    throw new Error('Fant ingen backups å gjenopprette fra.');
  }

  directories?.sort();
  return path.join(BACKUPS_DIR, directories?.at(-1));
}

const requestedBackupName = process.argv[2];
const backupDir = await resolveBackupDir(requestedBackupName);
const backupDbFile = path.join(backupDir, 'data', 'app-db.json');
const backupUploadsDir = path.join(backupDir, 'uploads');

if (!(await exists(backupDbFile))) {
  throw new Error(`Backupen ${backupDir} mangler app-db.json.`);
}

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.rm(DB_FILE, { force: true });
await fs.copyFile(backupDbFile, DB_FILE);

await fs.rm(UPLOADS_DIR, { recursive: true, force: true });

if (await exists(backupUploadsDir)) {
  await fs.cp(backupUploadsDir, UPLOADS_DIR, { recursive: true });
} else {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

console.log(`Backup gjenopprettet fra ${backupDir}`);
