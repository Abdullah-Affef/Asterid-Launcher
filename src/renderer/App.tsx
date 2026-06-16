import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ModsView } from './components/ModsView';
import { ResourcePacksView } from './components/ResourcePacksView';
import { ShadersView } from './components/ShadersView';
import { ModpacksView } from './components/ModpacksView';
import { SettingsView } from './components/SettingsView';
import { AccountView } from './components/AccountView';
import type { Account, LauncherSettings, VersionManifest } from './types';

export type Tab = 'dashboard' | 'mods' | 'resourcepacks' | 'shaders' | 'modpacks' | 'settings' | 'accounts';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [account, setAccount] = useState<Account | null>(null);
  const [settings, setSettings] = useState<LauncherSettings | null>(null);
  const [versions, setVersions] = useState<VersionManifest | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    window.electronAPI.settings.get().then(s => setSettings(s));
    window.electronAPI.accounts.current().then(a => setAccount(a));
    window.electronAPI.minecraft.versions().then(v => setVersions(v));
  }, []);

  useEffect(() => {
    window.electronAPI.window.isMaximized().then(m => setMaximized(m));
  }, []);

  useEffect(() => {
    window.electronAPI.onMainLog((msg: string) => {
      const time = new Date().toLocaleTimeString();
      setLogs(prev => [...prev, `[${time}] ${msg}`]);
    });
  }, []);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const refreshAccount = async () => {
    const a = await window.electronAPI.accounts.current();
    setAccount(a);
  };

  const refreshSettings = async () => {
    const s = await window.electronAPI.settings.get();
    setSettings(s);
  };

  const refreshVersions = async () => {
    const v = await window.electronAPI.minecraft.versions();
    setVersions(v);
  };

  const handleSettingsChange = async (updated: LauncherSettings) => {
    setSettings(updated);
    await window.electronAPI.settings.save(updated);
  };

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView account={account} settings={settings} versions={versions} onRefreshVersions={refreshVersions} onRefreshAccount={refreshAccount} onSettingsChange={handleSettingsChange} logs={logs} onClearLogs={clearLogs} addLog={addLog} />;
      case 'mods':
        return <ModsView settings={settings} addLog={addLog} />;
      case 'resourcepacks':
        return <ResourcePacksView settings={settings} addLog={addLog} />;
      case 'shaders':
        return <ShadersView settings={settings} addLog={addLog} />;
      case 'modpacks':
        return <ModpacksView settings={settings} addLog={addLog} />;
      case 'settings':
        return <SettingsView settings={settings} onSave={refreshSettings} />;
      case 'accounts':
        return <AccountView account={account} onRefresh={refreshAccount} />;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <div className="titlebar">
        <span className="titlebar-title">Asterid Launcher</span>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={() => window.electronAPI.window.minimize()}>─</button>
          <button className="titlebar-btn" onClick={async () => {
            await window.electronAPI.window.maximize();
            setMaximized(await window.electronAPI.window.isMaximized());
          }}>{maximized ? '❐' : '□'}</button>
          <button className="titlebar-btn titlebar-close" onClick={() => window.electronAPI.window.close()}>✕</button>
        </div>
      </div>
      <div className="layout">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} account={account} />
        <main className="main-content">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
