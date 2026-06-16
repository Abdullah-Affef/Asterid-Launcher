import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const BOOT_DIR = path.join(os.homedir(), '.asterid-launcher');
const BOOT_PATH = path.join(BOOT_DIR, 'boot.json');

export interface BootConfig {
  setupComplete: boolean;
  launcherDataDir: string;
  gameDirectory: string;
}

export function loadBoot(): BootConfig | null {
  try {
    if (fs.existsSync(BOOT_PATH)) {
      return JSON.parse(fs.readFileSync(BOOT_PATH, 'utf-8')) as BootConfig;
    }
  } catch {}
  return null;
}

export function saveBoot(config: BootConfig): void {
  if (!fs.existsSync(BOOT_DIR)) {
    fs.mkdirSync(BOOT_DIR, { recursive: true });
  }
  fs.writeFileSync(BOOT_PATH, JSON.stringify(config, null, 2));
}
