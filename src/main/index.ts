import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  getAccounts, getCurrentAccount, setCurrentAccount,
  removeAccount, loginWithElyBy, loginOffline, ensureValidToken, Account
} from './auth';
import { loadSettings, saveSettings, getSettings, LauncherSettings } from './settings';
import { fetchVersionManifest, launchMinecraft, killMinecraft, isMinecraftRunning } from './minecraft';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#0f0f0f',
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
  const sendLog = (msg: string) => {
    mainWindow?.webContents.send('main:log', msg);
  };

  ipcMain.handle('minecraft:launch', async (_e, settings: LauncherSettings, account: Account) => {
    try {
      sendLog('Preparing to launch Minecraft...');
      await launchMinecraft(settings, account, sendLog);
      sendLog('Minecraft launch command issued');
      return { success: true };
    } catch (err: any) {
      sendLog(`Launch error: ${err.message}`);
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle('minecraft:kill', () => killMinecraft());
  ipcMain.handle('minecraft:isRunning', () => isMinecraftRunning());

  ipcMain.handle('window:reload', () => {
    if (!mainWindow) return;
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      mainWindow.loadURL('http://localhost:5173');
    } else {
      mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    }
  });

  ipcMain.handle('modrinth:download', async (_e, projectId: string, mcVersion: string, loader: string, projectType: string) => {
    try {
      const settings = getSettings();
      const gameDir = settings.gameDirectory;
      const subDir = projectType === 'mod' ? 'mods' : projectType === 'resourcepack' ? 'resourcepacks' : projectType === 'shader' ? 'shaderpacks' : 'modpacks';
      const targetDir = path.join(gameDir, subDir);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

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
        }
        const combined = new Uint8Array(received);
        let pos = 0;
        for (const chunk of chunks) { combined.set(chunk, pos); pos += chunk.length; }
        const buffer = Buffer.from(combined.buffer);
        const filePath = path.join(targetDir, file.filename);
        fs.writeFileSync(filePath, buffer);
      } else {
        const buffer = Buffer.from(await fileRes.arrayBuffer());
        const filePath = path.join(targetDir, file.filename);
        fs.writeFileSync(filePath, buffer);
      }

      const size = file.size ? ` (${(file.size / 1024 / 1024).toFixed(1)}MB)` : '';
      sendLog(`Installed ${fileName} to ${subDir}/${size}`);
      return { success: true, path: path.join(targetDir, file.filename), filename: file.filename };
    } catch (err: any) {
      sendLog(`Download error: ${err.message}`);
      return { success: false, error: err.message };
    }
  });
}

app.whenReady().then(() => {
  loadSettings();
  setupIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killMinecraft();
  if (process.platform !== 'darwin') app.quit();
});
