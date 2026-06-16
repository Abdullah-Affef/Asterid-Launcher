import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { InstancesView } from './components/InstancesView';
import { ModrinthBrowser } from './components/ModrinthBrowser';
import { SettingsView } from './components/SettingsView';
import { AccountView } from './components/AccountView';
import type { Account, Instance, LauncherSettings, VersionManifest, ProgressData } from './types';

export type Tab = 'instances' | 'dashboard' | 'mods' | 'resourcepacks' | 'shaders' | 'modpacks' | 'settings' | 'accounts';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('instances');
  const [selectedInstance, setSelectedInstance] = useState<{ id: string; version: string; loader: string } | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [settings, setSettings] = useState<LauncherSettings | null>(null);
  const [versions, setVersions] = useState<VersionManifest | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);

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
    window.electronAPI.onMainProgress?.((data) => {
      setProgress(data);
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
      case 'instances':
        return <InstancesView account={account} versions={versions} logs={logs} onClearLogs={clearLogs} addLog={addLog} onSelectInstance={(inst) => setSelectedInstance(inst ? { id: inst.id, version: inst.version, loader: inst.loader } : null)} />;
      case 'dashboard':
        return <DashboardView account={account} settings={settings} versions={versions} onRefreshVersions={refreshVersions} onRefreshAccount={refreshAccount} onSettingsChange={handleSettingsChange} logs={logs} onClearLogs={clearLogs} addLog={addLog} />;
      case 'mods':
      case 'resourcepacks':
      case 'shaders':
      case 'modpacks': {
        if (!selectedInstance) {
          return (
            <div className="empty-state" style={{ padding: '48px 24px' }}>
              <span style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>📁</span>
              <h3>Select an instance first</h3>
              <p>Open an instance detail page to browse and install {activeTab}</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setActiveTab('instances')}>Go to Instances</button>
            </div>
          );
        }
        const projectTypeMap: Record<string, string> = { mods: 'mod', resourcepacks: 'resourcepack', shaders: 'shader', modpacks: 'modpack' };
        const titleMap: Record<string, string> = { mods: 'Mods', resourcepacks: 'Resource Packs', shaders: 'Shaders', modpacks: 'Modpacks' };
        const descMap: Record<string, string> = {
          mods: 'Browse and install mods from Modrinth to the selected instance',
          resourcepacks: 'Browse and install resource packs from Modrinth to the selected instance',
          shaders: 'Browse and install shaders from Modrinth to the selected instance',
          modpacks: 'Browse and install modpacks from Modrinth to the selected instance',
        };
        const iconMap: Record<string, string> = { mods: '⚡', resourcepacks: '🎨', shaders: '✨', modpacks: '📦' };
        return (
          <ModrinthBrowser
            projectType={projectTypeMap[activeTab]}
            title={titleMap[activeTab]}
            description={descMap[activeTab]}
            emptyIcon={iconMap[activeTab]}
            settings={{ selectedVersion: selectedInstance.version, loader: selectedInstance.loader } as any}
            addLog={addLog}
            instanceId={selectedInstance.id}
            key={selectedInstance.id + activeTab}
          />
        );
      }
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
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} account={account} selectedInstanceId={selectedInstance?.id ?? null} />
        <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
          {progress && progress.phase !== 'done' && (
            <div className="download-bar">
              <div className="download-bar-label">
                {progress.phase === 'client' && 'Downloading client...'}
                {progress.phase === 'libraries' && `Downloading libraries... (${progress.current}/${progress.total})`}
                {progress.phase === 'fabric' && `Downloading Fabric libraries... (${progress.current}/${progress.total})`}
                {progress.phase === 'assets' && `Downloading assets... (${progress.current}/${progress.total})`}
                {progress.phase === 'modrinth' && `Downloading... (${(progress.current / 1024 / 1024).toFixed(1)}MB)`}
              </div>
              <div className="download-bar-track">
                <div
                  className="download-bar-fill"
                  style={{
                    width: progress.total > 0
                      ? `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0 }}>
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}
