import { useState } from 'react';
import logo from '../../images/logo.png';

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [gameDir, setGameDir] = useState('');
  const [launcherDir, setLauncherDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSelectGameDir = async () => {
    const dir = await window.electronAPI.dialog.selectDirectory();
    if (dir) setGameDir(dir);
  };

  const handleSelectLauncherDir = async () => {
    const dir = await window.electronAPI.dialog.selectDirectory();
    if (dir) setLauncherDir(dir);
  };

  const handleContinue = async () => {
    if (!gameDir.trim() || !launcherDir.trim()) {
      setError('Both directories are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await window.electronAPI.setup.complete({
        gameDirectory: gameDir.trim(),
        launcherDataDir: launcherDir.trim(),
      });
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to save setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-wizard-overlay">
      <div className="setup-wizard-card">
        <div className="setup-wizard-logo">
          <img src={logo} alt="Asterid" />
        </div>
        <h1 className="setup-wizard-title">Welcome to Asterid Launcher</h1>
        <p className="setup-wizard-subtitle">
          Choose where to store game files and launcher data before getting started.
        </p>

        <div className="setup-wizard-field">
          <label className="form-label">Game Directory</label>
          <p className="setup-wizard-hint">Where Minecraft instances, versions, and mods are stored</p>
          <div className="setup-wizard-input-row">
            <input
              className="form-input"
              type="text"
              value={gameDir}
              onChange={e => setGameDir(e.target.value)}
              placeholder="e.g. D:/Minecraft or ~/.minecraft"
            />
            <button className="btn btn-secondary" onClick={handleSelectGameDir}>Browse</button>
          </div>
        </div>

        <div className="setup-wizard-field">
          <label className="form-label">Launcher Data Directory</label>
          <p className="setup-wizard-hint">Where launcher settings, accounts, and instance metadata are stored</p>
          <div className="setup-wizard-input-row">
            <input
              className="form-input"
              type="text"
              value={launcherDir}
              onChange={e => setLauncherDir(e.target.value)}
              placeholder="e.g. %APPDATA%/Asterid-Launcher"
            />
            <button className="btn btn-secondary" onClick={handleSelectLauncherDir}>Browse</button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button
          className="btn btn-primary setup-wizard-continue"
          onClick={handleContinue}
          disabled={loading || !gameDir.trim() || !launcherDir.trim()}
        >
          {loading ? 'Setting up...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
