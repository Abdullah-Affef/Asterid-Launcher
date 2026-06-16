import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { LauncherSettings } from './settings';
import { Account, ensureValidToken } from './auth';
import { execSync } from "child_process";


const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';

interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: { id: string; type: string; url: string; time: string; releaseTime: string }[];
}

function getBundledJavaPath(): string | null {
  const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
  const javaHome = path.join(basePath, 'runtime', 'java21');
  const javaExe = process.platform === 'win32' ? 'java.exe' : 'java';
  const fullPath = path.join(javaHome, 'bin', javaExe);
  const jvmCfg = path.join(javaHome, 'lib', 'jvm.cfg');
  if (fs.existsSync(fullPath) && fs.existsSync(jvmCfg)) {
    return fullPath;
  }
  return null;
}

function findJava(): string {
  const bundled = getBundledJavaPath();
  if (bundled) {
    console.log(`[Asterid] Using bundled Java: ${bundled}`);
    return bundled;
  }
  console.warn('[Asterid] Bundled Java not found, falling back to system PATH');
  try {
    const systemJava = execSync("where java", { encoding: "utf8" }).split("\r\n")[0]?.trim();
    if (systemJava) {
      console.log(`[Asterid] Using system Java: ${systemJava}`);
      return systemJava;
    }
  } catch {}
  throw new Error("Java 21 not found. Ensure runtime/java21/ has a valid JDK or install Java 21.");
}

interface VersionInfo {
  id: string;
  type: string;
  mainClass: string;
  minecraftArguments?: string;
  arguments?: { game: any[]; jvm: any[] };
  assetIndex: { id: string; url: string };
  assets: string;
  downloads: { client: { url: string }; server?: { url: string } };
  libraries: Library[];
}

interface Library {
  name: string;
  downloads?: {
    artifact?: { url: string; path: string };
    classifiers?: Record<string, { url: string; path: string }>;
  };
  natives?: Record<string, string>;
  rules?: Rule[];
}

interface Rule {
  action: 'allow' | 'disallow';
  os?: { name?: string; arch?: string; version?: string };
}

let currentProcess: ChildProcess | null = null;

function getOS(): string {
  switch (process.platform) {
    case 'win32': return 'windows';
    case 'darwin': return 'osx';
    default: return 'linux';
  }
}

function getArch(): string {
  return process.arch === 'x64' ? '64' : '32';
}

function evaluateRules(rules?: Rule[]): boolean {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    let matches = true;
    if (rule.os) {
      if (rule.os.name && rule.os.name !== getOS()) matches = false;
      if (rule.os.arch && rule.os.arch !== getArch()) matches = false;
    }
    if (matches) {
      allowed = rule.action === 'allow';
    }
  }
  return allowed;
}

function getLibraryPath(lib: Library, librariesDir: string): string | null {
  if (!evaluateRules(lib.rules)) return null;

  if (lib.natives) {
    const native = lib.natives[getOS()];
    if (!native || !lib.downloads?.classifiers) return null;
    const classifierKey = Object.keys(lib.downloads.classifiers)
      .find(k => k.includes(native));
    if (!classifierKey) return null;
    const artifact = lib.downloads.classifiers[classifierKey];
    return path.join(librariesDir, artifact.path);
  }

  if (lib.downloads?.artifact) {
    return path.join(librariesDir, lib.downloads.artifact.path);
  }

  return null;
}

export async function fetchVersionManifest(): Promise<VersionManifest> {
  const response = await fetch(MANIFEST_URL);
  return response.json() as Promise<VersionManifest>;
}

export async function fetchVersionInfo(versionUrl: string): Promise<VersionInfo> {
  const response = await fetch(versionUrl);
  return response.json() as Promise<VersionInfo>;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  ensureDir(path.dirname(dest));
  if (fs.existsSync(dest)) return;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(dest, buffer);
}

export type LogCallback = (msg: string) => void;

export async function downloadLibraries(gameDir: string, libraries: Library[], onLog?: LogCallback): Promise<string[]> {
  const librariesDir = path.join(gameDir, 'libraries');
  const classpath: string[] = [];

  for (const lib of libraries) {
    const libPath = getLibraryPath(lib, librariesDir);
    if (!libPath) continue;
    classpath.push(libPath);

    if (lib.downloads?.artifact) {
      if (!fs.existsSync(libPath)) {
        const shortName = lib.name.split(':').slice(1, 2).join(':');
        onLog?.(`Downloading library ${shortName}...`);
      }
      try {
        await downloadFile(lib.downloads.artifact.url, libPath);
      } catch (e) {
        console.warn(`Failed to download library: ${lib.name}`, e);
      }
    }

    if (lib.downloads?.classifiers) {
      for (const [, artifact] of Object.entries(lib.downloads.classifiers)) {
        const nativePath = path.join(librariesDir, artifact.path);
        try {
          await downloadFile(artifact.url, nativePath);
        } catch (e) {
          console.warn(`Failed to download native: ${lib.name}`, e);
        }
      }
    }
  }

  return classpath;
}

export async function downloadAssets(gameDir: string, assetIndex: { id: string; url: string }, onLog?: LogCallback): Promise<string> {
  const assetsDir = path.join(gameDir, 'assets');
  const indexPath = path.join(assetsDir, 'indexes', `${assetIndex.id}.json`);

  if (!fs.existsSync(indexPath)) {
    ensureDir(path.dirname(indexPath));
    onLog?.('Downloading asset index...');
    const response = await fetch(assetIndex.url);
    if (!response.ok) throw new Error('Failed to download asset index');
    const data = await response.json();
    fs.writeFileSync(indexPath, JSON.stringify(data));
  }

  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  const objects = indexData.objects || {};
  const entries = Object.entries(objects) as [string, { hash: string; size: number }][];
  const total = entries.length;

  let count = 0;
  let loggedPct = -1;
  for (const [key, obj] of entries) {
    const hash = obj.hash;
    const assetPath = path.join(assetsDir, 'objects', hash.substring(0, 2), hash);
    if (!fs.existsSync(assetPath)) {
      const url = `https://resources.download.minecraft.net/${hash.substring(0, 2)}/${hash}`;
      try {
        await downloadFile(url, assetPath);
        count++;
        const pct = Math.floor((count / total) * 100);
        if (pct >= loggedPct + 5) {
          loggedPct = pct;
          onLog?.(`Downloading assets... ${pct}% (${count}/${total})`);
        }
      } catch (e) {
        console.warn(`Failed to download asset: ${key}`, e);
      }
    }
  }

  if (count > 0) onLog?.(`Downloaded ${count} new assets`);
  return assetIndex.id;
}

export async function downloadClient(gameDir: string, id: string): Promise<string> {
  const versionsDir = path.join(gameDir, 'versions');
  const versionDir = path.join(versionsDir, id);
  const jarPath = path.join(versionDir, `${id}.jar`);
  const jsonPath = path.join(versionDir, `${id}.json`);

  if (fs.existsSync(jarPath) && fs.existsSync(jsonPath)) {
    const info = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    return jarPath;
  }

  ensureDir(versionDir);

  const manifest = await fetchVersionManifest();
  const version = manifest.versions.find(v => v.id === id);
  if (!version) throw new Error(`Version ${id} not found`);

  const versionInfo = await fetchVersionInfo(version.url);
  fs.writeFileSync(jsonPath, JSON.stringify(versionInfo));

  await downloadFile(versionInfo.downloads.client.url, jarPath);

  return jarPath;
}

export function getVersionJson(gameDir: string, id: string): VersionInfo | null {
  const versionsDir = path.join(gameDir, 'versions');
  const jsonPath = path.join(versionsDir, id, `${id}.json`);
  if (!fs.existsSync(jsonPath)) return null;
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

async function resolveVersionId(id: string): Promise<string> {
  if (id === 'latest_release' || id === 'latest_snapshot') {
    const manifest = await fetchVersionManifest();
    return id === 'latest_release' ? manifest.latest.release : manifest.latest.snapshot;
  }
  return id;
}

interface FabricLibrary {
  name: string;
  url: string;
}

interface FabricProfile {
  mainClass: string | { client: string; server: string };
  libraries: FabricLibrary[];
}

function mavenToRelativePath(mavenCoord: string): string {
  const parts = mavenCoord.split(':');
  const groupPath = parts[0].replace(/\./g, '/');
  const artifact = parts[1];
  const version = parts[2];
  return `${groupPath}/${artifact}/${version}/${artifact}-${version}.jar`;
}

function mavenToUrl(repoUrl: string, mavenCoord: string): string {
  const base = repoUrl.endsWith('/') ? repoUrl : repoUrl + '/';
  return base + mavenToRelativePath(mavenCoord);
}

async function getFabricProfile(mcVersion: string): Promise<FabricProfile | null> {
  try {
    const loaderRes = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
    if (!loaderRes.ok) return null;
    const loaders = await loaderRes.json() as any[];
    if (loaders.length === 0) return null;

    const loaderVersion = loaders[0].loader.version;

    const profileRes = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`);
    if (!profileRes.ok) return null;
    const profile = await profileRes.json() as any;

    return {
      mainClass: profile.mainClass,
      libraries: profile.libraries || [],
    };
  } catch {
    return null;
  }
}

export async function launchMinecraft(
  settings: LauncherSettings,
  account: Account,
  onLog?: LogCallback
): Promise<ChildProcess | null> {
  if (currentProcess) {
    currentProcess.kill();
    currentProcess = null;
  }

  const validAccount = await ensureValidToken(account);
  if (!validAccount) throw new Error('Authentication failed or expired');

  const versionId = settings.selectedVersion;
  const resolvedVersionId = await resolveVersionId(versionId);
  const gameDir = settings.gameDirectory;
  ensureDir(gameDir);

  const jarPath = await downloadClient(gameDir, resolvedVersionId);
  const versionInfo = getVersionJson(gameDir, resolvedVersionId);
  if (!versionInfo) throw new Error(`Version info not found for ${resolvedVersionId}`);

  const librariesDir = path.join(gameDir, 'libraries');
  const classpath = await downloadLibraries(gameDir, versionInfo.libraries, onLog);

  let fabricProfile: FabricProfile | null = null;
  if (settings.loader === 'fabric') {
    onLog?.('Fetching Fabric profile...');
    fabricProfile = await getFabricProfile(resolvedVersionId);
    if (fabricProfile) {
      onLog?.('Downloading Fabric libraries...');
      for (const lib of fabricProfile.libraries) {
        const libRelPath = mavenToRelativePath(lib.name);
        const libPath = path.join(librariesDir, libRelPath);
        if (!fs.existsSync(libPath)) {
          const url = mavenToUrl(lib.url, lib.name);
          try {
            await downloadFile(url, libPath);
          } catch (e) {
            console.warn(`Failed to download Fabric library: ${lib.name}`, e);
          }
        }
        classpath.push(libPath);
      }
    } else {
      onLog?.('Warning: Could not fetch Fabric profile, launching as vanilla');
    }
  }

  classpath.push(jarPath);

  const nativesDir = path.join(app.getPath('userData'), 'natives', versionId);
  ensureDir(nativesDir);

  const assetIndex = await downloadAssets(gameDir, versionInfo.assetIndex, onLog);

  const javaPath = settings.javaPath || findJava();

  const mainClass = fabricProfile
    ? (typeof fabricProfile.mainClass === 'string' ? fabricProfile.mainClass : fabricProfile.mainClass.client)
    : versionInfo.mainClass;
  let gameArgs: string[] = [];

  const va = validAccount;
  const vi = versionInfo;

  if (versionInfo.arguments) {
    const gameArgList = versionInfo.arguments.game || [];
    for (const arg of gameArgList) {
      if (typeof arg === 'string') {
        gameArgs.push(arg);
      }
    }
  } else if (versionInfo.minecraftArguments) {
    gameArgs = versionInfo.minecraftArguments.split(' ');
  }

  const assetsDir = path.join(gameDir, 'assets');

  function replaceTokens(args: string[]): string[] {
    const tokens: Record<string, string> = {
      '${auth_player_name}': va.username,
      '${auth_session}': va.accessToken,
      '${auth_access_token}': va.accessToken,
      '${auth_uuid}': va.uuid,
      '${version_name}': resolvedVersionId,
      '${game_directory}': gameDir,
      '${game_assets}': path.join(assetsDir, 'virtual', 'legacy'),
      '${assets_root}': assetsDir,
      '${assets_index_name}': assetIndex,
      '${user_type}': 'mojang',
      '${version_type}': vi.type,
      '${natives_directory}': nativesDir,
      '${launcher_name}': 'custom-launcher',
      '${launcher_version}': '1.0.0',
      '${classpath}': classpath.join(path.delimiter),
      '${library_directory}': librariesDir,
    };

    return args.map(arg => {
      for (const [key, val] of Object.entries(tokens)) {
        arg = arg.replace(key, val);
      }
      return arg;
    });
  }

  gameArgs = replaceTokens(gameArgs);

  const jvmArgs: string[] = [
    `-Xms${settings.minRam}G`,
    `-Xmx${settings.maxRam}G`,
    `-Djava.library.path=${nativesDir}`,
    `-Dminecraft.launcher.brand=custom-launcher`,
    `-Dminecraft.launcher.version=1.0.0`,
    `-cp`, classpath.join(path.delimiter),
    mainClass,
    ...gameArgs,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(javaPath, jvmArgs, {
      cwd: gameDir,
      stdio: 'pipe',
    });

    currentProcess = child;

    child.stdout?.on('data', (data) => {
      const lines = data.toString().trim().split('\n').filter(Boolean);
      lines.forEach((l: string) => onLog?.(`[Minecraft] ${l}`));
    });

    child.stderr?.on('data', (data) => {
      const lines = data.toString().trim().split('\n').filter(Boolean);
      lines.forEach((l: string) => onLog?.(`[Minecraft] ${l}`));
    });

    child.on('error', (err) => {
      currentProcess = null;
      onLog?.(`Failed to start Minecraft: ${err.message}`);
      reject(err);
    });

    child.on('close', (code) => {
      currentProcess = null;
      onLog?.(`Minecraft exited with code ${code}`);
    });

    resolve(child);
  });
}

export function killMinecraft() {
  if (currentProcess) {
    currentProcess.kill('SIGKILL');
    currentProcess = null;
  }
}

export function isMinecraftRunning(): boolean {
  return currentProcess !== null && currentProcess.exitCode === null;
}
