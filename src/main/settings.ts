import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

export interface LauncherSettings {
  javaPath: string;
  minRam: number;
  maxRam: number;
  gameDirectory: string;
  selectedVersion: string;
  loader: 'vanilla' | 'fabric';
  autoLogin: boolean;
  elyClientId: string;
  _baseDir?: string;
}

const defaultSettings: LauncherSettings = {
  javaPath: '',
  minRam: 2,
  maxRam: 4,
  gameDirectory: path.join(app.getPath('home'), '.minecraft'),
  selectedVersion: 'latest_release',
  loader: 'vanilla',
  autoLogin: false,
  elyClientId: '',
};

let settings: LauncherSettings = { ...defaultSettings };

export function loadSettings(): LauncherSettings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      settings = { ...defaultSettings, ...data };
    }
  } catch {}
  return settings;
}

export function saveSettings(newSettings: LauncherSettings): LauncherSettings {
  settings = { ...newSettings };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return settings;
}

export function getSettings(): LauncherSettings {
  return settings;
}
