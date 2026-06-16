import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

function getInstancesPath(): string {
  return path.join(app.getPath('userData'), 'instances.json');
}

export interface Instance {
  id: string;
  name: string;
  version: string;
  loader: 'vanilla' | 'fabric';
  minRam: number;
  maxRam: number;
  javaPath: string;
  created: number;
  lastPlayed: number | null;
}

function getBaseDir(): string {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  let gameDir = path.join(app.getPath('home'), '.minecraft');
  try {
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (data.gameDirectory) gameDir = data.gameDirectory;
    }
  } catch {}
  return gameDir;
}

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'instance';
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadInstances(): Instance[] {
  try {
    const p = getInstancesPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveInstances(instances: Instance[]) {
  fs.writeFileSync(getInstancesPath(), JSON.stringify(instances, null, 2));
}

export function getInstances(): Instance[] {
  return loadInstances();
}

export function getInstance(id: string): Instance | null {
  return loadInstances().find(i => i.id === id) || null;
}

export function createInstance(data: { name: string; version: string; loader: 'vanilla' | 'fabric'; minRam?: number; maxRam?: number; javaPath?: string }): Instance {
  const instances = loadInstances();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newInstance: Instance = {
    id,
    name: data.name,
    version: data.version,
    loader: data.loader,
    minRam: data.minRam ?? 2,
    maxRam: data.maxRam ?? 4,
    javaPath: data.javaPath ?? '',
    created: Date.now(),
    lastPlayed: null,
  };
  instances.push(newInstance);
  saveInstances(instances);

  const instanceDir = path.join(getBaseDir(), sanitizeName(data.name));
  ensureDir(path.join(instanceDir, 'mods'));
  ensureDir(path.join(instanceDir, 'resourcepacks'));
  ensureDir(path.join(instanceDir, 'shaderpacks'));
  ensureDir(path.join(instanceDir, 'saves'));
  ensureDir(path.join(instanceDir, 'versions'));
  ensureDir(path.join(instanceDir, 'libraries'));
  ensureDir(path.join(instanceDir, 'assets'));

  return newInstance;
}

export function updateInstance(id: string, data: Partial<Instance>): Instance | null {
  const instances = loadInstances();
  const idx = instances.findIndex(i => i.id === id);
  if (idx === -1) return null;
  const oldName = instances[idx].name;
  instances[idx] = { ...instances[idx], ...data };
  saveInstances(instances);

  if (data.name && data.name !== oldName) {
    const oldDir = path.join(getBaseDir(), sanitizeName(oldName));
    const newDir = path.join(getBaseDir(), sanitizeName(data.name));
    if (fs.existsSync(oldDir) && oldDir !== newDir) {
      fs.renameSync(oldDir, newDir);
    }
  }

  return instances[idx];
}

export function deleteInstance(id: string): boolean {
  const instances = loadInstances();
  const idx = instances.findIndex(i => i.id === id);
  if (idx === -1) return false;
  const inst = instances[idx];
  instances.splice(idx, 1);
  saveInstances(instances);

  const instanceDir = path.join(getBaseDir(), sanitizeName(inst.name));
  if (fs.existsSync(instanceDir)) {
    fs.rmSync(instanceDir, { recursive: true, force: true });
  }
  return true;
}

export function getInstanceDir(id: string): string {
  const instances = loadInstances();
  const inst = instances.find(i => i.id === id);
  if (!inst) return '';
  return path.join(getBaseDir(), sanitizeName(inst.name));
}
