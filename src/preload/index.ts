import { contextBridge, ipcRenderer } from 'electron';

let logCallback: ((msg: string) => void) | null = null;

ipcRenderer.on('main:log', (_e, msg: string) => {
  logCallback?.(msg);
});

contextBridge.exposeInMainWorld('electronAPI', {
  onMainLog: (cb: (msg: string) => void) => { logCallback = cb; },
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
    kill: () => ipcRenderer.invoke('minecraft:kill'),
    isRunning: () => ipcRenderer.invoke('minecraft:isRunning'),
  },
  modrinth: {
    download: (projectId: string, mcVersion: string, loader: string, projectType: string) =>
      ipcRenderer.invoke('modrinth:download', projectId, mcVersion, loader, projectType),
  },
});
