import { contextBridge, ipcRenderer } from 'electron';

let logCallback: ((msg: string) => void) | null = null;
let progressCallback: ((data: { phase: string; current: number; total: number }) => void) | null = null;
let setupDoneCallback: (() => void) | null = null;
let updateStatusCallback: ((data: { status: string; info?: any; progress?: any; error?: string }) => void) | null = null;

ipcRenderer.on('main:log', (_e, msg: string) => {
  logCallback?.(msg);
});

ipcRenderer.on('main:progress', (_e, data: { phase: string; current: number; total: number }) => {
  progressCallback?.(data);
});

ipcRenderer.on('setup:done', () => {
  setupDoneCallback?.();
});

ipcRenderer.on('update:status', (_e, data) => {
  updateStatusCallback?.(data);
});

contextBridge.exposeInMainWorld('electronAPI', {
  onMainLog: (cb: (msg: string) => void) => { logCallback = cb; },
  onMainProgress: (cb: (data: { phase: string; current: number; total: number }) => void) => { progressCallback = cb; },
  onSetupDone: (cb: () => void) => { setupDoneCallback = cb; },
  onUpdateStatus: (cb: (data: { status: string; info?: any; progress?: any; error?: string }) => void) => { updateStatusCallback = cb; },
  setup: {
    isNeeded: () => ipcRenderer.invoke('setup:isNeeded'),
    complete: (data: { launcherDataDir: string; gameDirectory: string }) => ipcRenderer.invoke('setup:complete', data),
  },
  dialog: {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    reload: () => ipcRenderer.invoke('window:reload'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (s: any) => ipcRenderer.invoke('settings:save', s),
  },
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    current: () => ipcRenderer.invoke('accounts:current'),
    setCurrent: (uuid: string) => ipcRenderer.invoke('accounts:setCurrent', uuid),
    remove: (uuid: string) => ipcRenderer.invoke('accounts:remove', uuid),
    login: () => ipcRenderer.invoke('accounts:login'),
    loginOffline: (username: string) => ipcRenderer.invoke('accounts:loginOffline', username),
    refresh: (account: any) => ipcRenderer.invoke('accounts:refresh', account),
  },
  minecraft: {
    versions: () => ipcRenderer.invoke('minecraft:versions'),
    launch: (settings: any, account: any) => ipcRenderer.invoke('minecraft:launch', settings, account),
    launchInstance: (instance: any, account: any) => ipcRenderer.invoke('minecraft:launchInstance', instance, account),
    kill: () => ipcRenderer.invoke('minecraft:kill'),
    isRunning: () => ipcRenderer.invoke('minecraft:isRunning'),
  },
  modrinth: {
    download: (projectId: string, mcVersion: string, loader: string, projectType: string) =>
      ipcRenderer.invoke('modrinth:download', projectId, mcVersion, loader, projectType),
    downloadToInstance: (projectId: string, mcVersion: string, loader: string, projectType: string, instanceId: string) =>
      ipcRenderer.invoke('modrinth:downloadToInstance', projectId, mcVersion, loader, projectType, instanceId),
  },
  instances: {
    list: () => ipcRenderer.invoke('instances:list'),
    get: (id: string) => ipcRenderer.invoke('instances:get', id),
    create: (data: any) => ipcRenderer.invoke('instances:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('instances:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('instances:delete', id),
    getDir: (id: string) => ipcRenderer.invoke('instances:getDir', id),
  },
});
