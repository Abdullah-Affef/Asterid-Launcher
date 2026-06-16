import { useState, useEffect } from 'react';
import type { LauncherSettings } from '../types';

interface Props {
  settings: LauncherSettings | null;
  onSave: () => void;
}

export function SettingsView({ settings, onSave }: Props) {
  const [local, setLocal] = useState<LauncherSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setLocal({ ...settings });
  }, [settings]);

  const update = (key: keyof LauncherSettings, value: any) => {
    if (!local) return;
    setLocal({ ...local, [key]: value });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!local) return;
    await window.electronAPI.settings.save(local);
    setSaved(true);
    onSave();
    setTimeout(() => setSaved(false), 2000);
  };

  if (!local) return <div className="loading"><div className="spinner" /> Loading...</div>;

  return (
    <div>
      <div className="view-header">
        <h1>Settings</h1>
        <p>Configure your launcher and game</p>
      </div>

      <div style={{ maxWidth: 560 }}>
        <div className="form-group">
          <label className="form-label">Java Path</label>
          <input
            className="form-input"
            placeholder="Auto-detect (leave empty)"
            value={local.javaPath}
            onChange={e => update('javaPath', e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Minimum RAM (GB)</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="32"
              value={local.minRam}
              onChange={e => update('minRam', parseInt(e.target.value) || 2)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Maximum RAM (GB)</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="64"
              value={local.maxRam}
              onChange={e => update('maxRam', parseInt(e.target.value) || 4)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Game Directory</label>
          <input
            className="form-input"
            value={local.gameDirectory}
            onChange={e => update('gameDirectory', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Ely.by Client ID</label>
          <input
            className="form-input"
            placeholder="minecraft-launcher (leave empty for default)"
            value={local.elyClientId}
            onChange={e => update('elyClientId', e.target.value)}
          />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            If you get "Cannot find application" error, create an app at account.ely.by and paste the Client ID here
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">
            <input
              type="checkbox"
              checked={local.autoLogin}
              onChange={e => update('autoLogin', e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Auto-login on launch
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
          {saved && <span className="success-text">Settings saved!</span>}
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>About</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Minecraft Launcher v1.0.0<br />
            Built with Electron + React<br />
            Authentication via Ely.by
          </p>
        </div>
      </div>
    </div>
  );
}
