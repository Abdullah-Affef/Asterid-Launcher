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
}

export interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: { id: string; type: string; url: string; time: string; releaseTime: string }[];
}

export interface ElectronAPI {
  onMainLog: (cb: (msg: string) => void) => void;
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
    kill: () => Promise<void>;
    isRunning: () => Promise<boolean>;
  };
  modrinth: {
    download: (projectId: string, mcVersion: string, loader: string, projectType: string) =>
      Promise<{ success: boolean; path?: string; filename?: string; error?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
