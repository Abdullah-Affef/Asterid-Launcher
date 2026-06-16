import { useState, useEffect, useRef } from 'react';
import type { Account, LauncherSettings, VersionManifest } from '../types';

interface Props {
  account: Account | null;
  settings: LauncherSettings | null;
  versions: VersionManifest | null;
  onRefreshVersions: () => void;
  onRefreshAccount: () => void;
  onSettingsChange: (s: LauncherSettings) => void;
  logs: string[];
  onClearLogs: () => void;
  addLog: (msg: string) => void;
}

export function DashboardView({ account, settings, versions, onRefreshVersions, onRefreshAccount, onSettingsChange, logs, onClearLogs, addLog }: Props) {
  const [launching, setLaunching] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [localVersion, setLocalVersion] = useState(settings?.selectedVersion || 'latest_release');
  const [localLoader, setLocalLoader] = useState(settings?.loader || 'vanilla');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings) {
      setLocalVersion(settings.selectedVersion);
      setLocalLoader(settings.loader);
    }
  }, [settings]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleVersionChange = (val: string) => {
    setLocalVersion(val);
    if (settings) {
      onSettingsChange({ ...settings, selectedVersion: val });
    }
  };

  const handleLoaderChange = (val: 'vanilla' | 'fabric') => {
    setLocalLoader(val);
    if (settings) {
      onSettingsChange({ ...settings, loader: val });
    }
  };

  const checkRunning = async () => {
    const isRunning = await window.electronAPI.minecraft.isRunning();
    setRunning(isRunning);
    return isRunning;
  };

  const handleLaunch = async () => {
    if (!account) { setError('Please login first'); return; }
    if (!settings) { setError('Settings not loaded'); return; }

    if (running) {
      addLog('Stopping Minecraft...');
      await window.electronAPI.minecraft.kill();
      setRunning(false);
      addLog('Minecraft stopped');
      return;
    }

    setLaunching(true);
    setError('');

    addLog(`Launching Minecraft ${localVersion} with ${localLoader}...`);
    const result = await window.electronAPI.minecraft.launch(settings, account);
    setLaunching(false);

    if (result.success) {
      addLog('Minecraft launched successfully');
      setRunning(true);
      setTimeout(checkRunning, 1000);
    } else {
      const errMsg = result.error || 'Failed to launch';
      addLog(`Error: ${errMsg}`);
      setError(errMsg);
    }
  };

  const resolvedVersion = versions?.versions?.find(v => v.id === localVersion)
    ? localVersion
    : versions?.latest?.release || 'Unknown';
  const versionLabel = localLoader !== 'vanilla'
    ? `${localLoader.charAt(0).toUpperCase() + localLoader.slice(1)} ${resolvedVersion}`
    : resolvedVersion;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div>
        <div className="view-header">
          <h1>Dashboard</h1>
          <p>Launch and manage your Minecraft game</p>
        </div>

        <div className="dashboard-play">
          <div className="dashboard-play-top">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {versions && (
                <select
                  className="dashboard-version-select"
                  value={localVersion}
                  onChange={e => handleVersionChange(e.target.value)}
                >
                  <optgroup label="Latest">
                    <option value="latest_release">Latest Release ({versions.latest.release})</option>
                    <option value="latest_snapshot">Latest Snapshot ({versions.latest.snapshot})</option>
                  </optgroup>
                  <optgroup label="All versions">
                    {versions.versions.map(v => (
                      <option key={v.id} value={v.id}>{v.id} ({v.type})</option>
                    ))}
                  </optgroup>
                </select>
              )}
              <select
                className="dashboard-version-select"
                value={localLoader}
                onChange={e => handleLoaderChange(e.target.value as 'vanilla' | 'fabric')}
                style={{ minWidth: 100 }}
              >
                <option value="vanilla">Vanilla</option>
                <option value="fabric">Fabric</option>
              </select>
            </div>
            <button
              className={`play-btn ${running ? 'playing' : ''}`}
              onClick={handleLaunch}
              disabled={launching}
            >
              {launching ? 'Launching...' : running ? 'Stop' : 'Play'}
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>

        <div className="dashboard-info">
          <div className="info-card">
            <div className="info-card-label">Account</div>
            <div className="info-card-value" style={{ color: account ? 'var(--success)' : 'var(--text-muted)' }}>
              {account ? account.username : 'Not logged in'}
            </div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Version</div>
            <div className="info-card-value">{versionLabel}</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Loader</div>
            <div className="info-card-value" style={{ textTransform: 'capitalize' }}>{localLoader}</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Memory</div>
            <div className="info-card-value">
              {settings ? `${settings.minRam}GB - ${settings.maxRam}GB` : 'Not set'}
            </div>
          </div>
        </div>
      </div>

      <div className="log-panel">
        <div className="log-panel-header">
          <span>Console</span>
          <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={onClearLogs}>Clear</button>
        </div>
        <div className="log-panel-body">
          {logs.length === 0 && <span className="log-empty">No output yet</span>}
          {logs.map((line, i) => (
            <div key={i} className="log-line">{line}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
