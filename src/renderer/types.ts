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

export interface Account {
  uuid: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  expiry: number;
  offline: boolean;
}

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

export interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: { id: string; type: string; url: string; time: string; releaseTime: string }[];
}

export interface ProgressData {
  phase: string;
  current: number;
  total: number;
}

export interface ElectronAPI {
  onMainLog: (cb: (msg: string) => void) => void;
  onMainProgress?: (cb: (data: { phase: string; current: number; total: number }) => void) => void;
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    reload: () => Promise<void>;
  };
  settings: {
    get: () => Promise<LauncherSettings>;
    save: (s: LauncherSettings) => Promise<LauncherSettings>;
  };
  accounts: {
    list: () => Promise<Account[]>;
    current: () => Promise<Account | null>;
    setCurrent: (uuid: string) => Promise<void>;
    remove: (uuid: string) => Promise<void>;
    login: () => Promise<Account | null>;
    loginOffline: (username: string) => Promise<Account>;
    refresh: (account: Account) => Promise<Account | null>;
  };
  minecraft: {
    versions: () => Promise<VersionManifest | null>;
    launch: (settings: LauncherSettings, account: Account) => Promise<{ success: boolean; error?: string }>;
    launchInstance: (instance: Instance, account: Account) => Promise<{ success: boolean; error?: string }>;
    kill: () => Promise<void>;
    isRunning: () => Promise<boolean>;
  };
  modrinth: {
    download: (projectId: string, mcVersion: string, loader: string, projectType: string) =>
      Promise<{ success: boolean; path?: string; filename?: string; error?: string }>;
    downloadToInstance: (projectId: string, mcVersion: string, loader: string, projectType: string, instanceId: string) =>
      Promise<{ success: boolean; path?: string; filename?: string; error?: string }>;
  };
  instances: {
    list: () => Promise<Instance[]>;
    get: (id: string) => Promise<Instance | null>;
    create: (data: { name: string; version: string; loader: 'vanilla' | 'fabric'; minRam?: number; maxRam?: number; javaPath?: string }) => Promise<Instance>;
    update: (id: string, data: Partial<Instance>) => Promise<Instance | null>;
    delete: (id: string) => Promise<boolean>;
    getDir: (id: string) => Promise<string>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
