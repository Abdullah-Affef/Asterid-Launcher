import { app, BrowserWindow, ipcMain, shell, nativeImage, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  getAccounts, getCurrentAccount, setCurrentAccount,
  removeAccount, loginWithElyBy, loginOffline, ensureValidToken, Account
} from './auth';
import { loadSettings, saveSettings, getSettings, LauncherSettings } from './settings';
import { fetchVersionManifest, launchMinecraft, killMinecraft, isMinecraftRunning } from './minecraft';
import { getInstances, getInstance, createInstance, updateInstance, deleteInstance, getInstanceDir, Instance } from './instances';
import { loadBoot, saveBoot, BootConfig } from './boot';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'icon.png');
  let taskbarIcon;
  try {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      const size = img.getSize();
      const minDim = Math.min(size.width, size.height);
      const x = Math.floor((size.width - minDim) / 2);
      const y = Math.floor((size.height - minDim) / 2);
      const cropped = img.crop({ x, y, width: minDim, height: minDim });
      taskbarIcon = cropped.resize({ width: 84, height: 84 });
    }
  } catch {}

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    icon: taskbarIcon || iconPath,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#0f0f0f',
    title: 'Asterid Launcher',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }
}

function sendLog(msg: string) {
  mainWindow?.webContents.send('main:log', msg);
}

function sendProgress(phase: string, current: number, total: number) {
  mainWindow?.webContents.send('main:progress', { phase, current, total });
}

function setupIPC() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:save', (_e, s: LauncherSettings) => saveSettings(s));

  ipcMain.handle('accounts:list', () => getAccounts());
  ipcMain.handle('accounts:current', () => getCurrentAccount());
  ipcMain.handle('accounts:setCurrent', (_e, uuid: string) => setCurrentAccount(uuid));
  ipcMain.handle('accounts:remove', (_e, uuid: string) => removeAccount(uuid));
  ipcMain.handle('accounts:login', async () => {
    if (!mainWindow) return null;
    const settings = getSettings();
    return loginWithElyBy(mainWindow, (settings as any).elyClientId || 'minecraft-launcher');
  });
  ipcMain.handle('accounts:loginOffline', (_e, username: string) => {
    return loginOffline(username);
  });
  ipcMain.handle('accounts:refresh', async (_e, account: Account) => {
    return ensureValidToken(account);
  });

  ipcMain.handle('minecraft:versions', async () => {
    try {
      const manifest = await fetchVersionManifest();
      return manifest;
    } catch {
      return null;
    }
  });

  ipcMain.handle('minecraft:launchInstance', async (_e, instance: Instance, account: Account) => {
    try {
      const globSettings = getSettings();
      const instDir = getInstanceDir(instance.id);
      const mergedSettings: LauncherSettings = {
        ...globSettings,
        selectedVersion: instance.version,
        loader: instance.loader,
        minRam: instance.minRam,
        maxRam: instance.maxRam,
        javaPath: instance.javaPath || globSettings.javaPath,
        gameDirectory: instDir,
      };
      sendLog('Preparing to launch instance...');
      await launchMinecraft(mergedSettings, account, sendLog, sendProgress);
      sendLog('Instance launched');
      sendProgress('done', 1, 1);
      return { success: true };
    } catch (err: any) {
      sendLog(`Launch error: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('minecraft:launch', async (_e, settings: LauncherSettings, account: Account) => {
    try {
      sendLog('Preparing to launch Minecraft...');
      await launchMinecraft(settings, account, sendLog, sendProgress);
      sendLog('Minecraft launch command issued');
      sendProgress('done', 1, 1);
      return { success: true };
    } catch (err: any) {
      sendLog(`Launch error: ${err.message}`);
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle('minecraft:kill', () => killMinecraft());
  ipcMain.handle('minecraft:isRunning', () => isMinecraftRunning());

  ipcMain.handle('instances:list', () => getInstances());
  ipcMain.handle('instances:get', (_e, id: string) => getInstance(id));
  ipcMain.handle('instances:create', (_e, data: { name: string; version: string; loader: 'vanilla' | 'fabric' }) => createInstance(data));
  ipcMain.handle('instances:update', (_e, id: string, data: any) => updateInstance(id, data));
  ipcMain.handle('instances:delete', (_e, id: string) => deleteInstance(id));
  ipcMain.handle('instances:getDir', (_e, id: string) => getInstanceDir(id));

  ipcMain.handle('window:reload', () => {
    if (!mainWindow) return;
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      mainWindow.loadURL('http://localhost:5173');
    } else {
      mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    }
  });

  async function downloadModrinthProject(projectId: string, mcVersion: string, loader: string, projectType: string, targetDir: string) {
    const subDir = projectType === 'mod' ? 'mods' : projectType === 'resourcepack' ? 'resourcepacks' : projectType === 'shader' ? 'shaderpacks' : 'modpacks';
    const fullDir = path.join(targetDir, subDir);
    if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });

    sendLog(`Fetching version info for project...`);
    const versionsRes = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`);
    if (!versionsRes.ok) throw new Error('Failed to fetch versions');
    const versions: any[] = await versionsRes.json() as any[];

    const compatible = versions.find(v => {
      const hasMc = v.game_versions?.includes(mcVersion);
      const hasLoader = !loader || loader === 'vanilla' || v.loaders?.includes(loader);
      return hasMc && hasLoader;
    }) || versions[0];

    if (!compatible) throw new Error('No compatible version found');
    const file = compatible.files?.[0];
    if (!file) throw new Error('No files in version');

    const versionName = compatible.version_number || 'unknown';
    const fileName = file.filename || 'unknown';
    sendLog(`Downloading ${fileName} (${versionName})...`);

    const fileRes = await fetch(file.url);
    if (!fileRes.ok) throw new Error('Failed to download file');

    const contentLength = fileRes.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength) : 0;

    if (total > 0 && fileRes.body) {
      const reader = fileRes.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      let lastPct = -1;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        const pct = Math.floor((received / total) * 100);
        if (pct >= lastPct + 10) {
          lastPct = pct;
          sendLog(`Downloading ${fileName}... ${pct}% (${(received / 1024 / 1024).toFixed(1)}MB)`);
        }
        sendProgress('modrinth', received, total);
      }
      const combined = new Uint8Array(received);
      let pos = 0;
      for (const chunk of chunks) { combined.set(chunk, pos); pos += chunk.length; }
      const buffer = Buffer.from(combined.buffer);
      const filePath = path.join(fullDir, file.filename);
      fs.writeFileSync(filePath, buffer);
    } else {
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const filePath = path.join(fullDir, file.filename);
      fs.writeFileSync(filePath, buffer);
    }

    const size = file.size ? ` (${(file.size / 1024 / 1024).toFixed(1)}MB)` : '';
    sendLog(`Installed ${fileName} to ${subDir}/${size}`);
    return { success: true, path: path.join(fullDir, file.filename), filename: file.filename };
  }

  ipcMain.handle('modrinth:download', async (_e, projectId: string, mcVersion: string, loader: string, projectType: string) => {
    try {
      const settings = getSettings();
      return await downloadModrinthProject(projectId, mcVersion, loader, projectType, settings.gameDirectory);
    } catch (err: any) {
      sendLog(`Download error: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('modrinth:downloadToInstance', async (_e, projectId: string, mcVersion: string, loader: string, projectType: string, instanceId: string) => {
    try {
      const instDir = getInstanceDir(instanceId);
      return await downloadModrinthProject(projectId, mcVersion, loader, projectType, instDir);
    } catch (err: any) {
      sendLog(`Download error: ${err.message}`);
      return { success: false, error: err.message };
    }
  });
}

function setupSetupIPC() {
  ipcMain.handle('setup:complete', (_e, data: { launcherDataDir: string; gameDirectory: string }) => {
    const boot: BootConfig = {
      setupComplete: true,
      launcherDataDir: data.launcherDataDir,
      gameDirectory: data.gameDirectory,
    };
    saveBoot(boot);

    if (data.launcherDataDir) {
      app.setPath('userData', data.launcherDataDir);
    }

    loadSettings();
    const s = getSettings();
    s.gameDirectory = data.gameDirectory;
    saveSettings(s);

    // Register main IPC handlers now that setup is done
    setupIPC();

    mainWindow?.webContents.send('setup:done');
    return { success: true };
  });
}

function setupAutoUpdater() {
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:status', { status: 'available', info });
  });

  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('update:status', { status: 'not-available', info });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:status', { status: 'downloading', progress });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:status', { status: 'downloaded', info });
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update:status', { status: 'error', error: err.message });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // silently fail
    });
  }, 5000);
}

app.whenReady().then(() => {
  const boot = loadBoot();

  // Always register these handlers (needed regardless of setup state)
  ipcMain.handle('setup:isNeeded', () => {
    const b = loadBoot();
    return {
      needed: !b?.setupComplete,
      defaults: {
        gameDirectory: b?.gameDirectory || path.join(app.getPath('home'), '.minecraft'),
        launcherDataDir: b?.launcherDataDir || app.getPath('userData'),
      },
    };
  });

  ipcMain.handle('dialog:selectDirectory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  if (boot?.setupComplete) {
    if (boot.launcherDataDir) {
      app.setPath('userData', boot.launcherDataDir);
    }
    loadSettings();
    setupIPC();
  } else {
    setupSetupIPC();
  }

  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killMinecraft();
  if (process.platform !== 'darwin') app.quit();
});
