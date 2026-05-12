import { existsSync, readFileSync } from 'node:fs';

const ENV_FILE = '.env';

try {
  if (existsSync(ENV_FILE)) {
    const content = readFileSync(ENV_FILE, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      if (key in process.env) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
} catch (err) {
  console.warn(`[env] Klarte ikke lese ${ENV_FILE}:`, err.message);
}
