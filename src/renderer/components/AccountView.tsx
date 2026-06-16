import { useState, useEffect } from 'react';
import type { Account } from '../types';

interface Props {
  account: Account | null;
  onRefresh: () => void;
}

export function AccountView({ account, onRefresh }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offlineName, setOfflineName] = useState('');

  useEffect(() => {
    loadAccounts();
  }, [account]);

  const loadAccounts = async () => {
    const list = await window.electronAPI.accounts.list();
    setAccounts(list);
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await window.electronAPI.accounts.login();
      await loadAccounts();
      onRefresh();
    } catch (e: any) {
      setError(e.message || 'Login failed');
    }
    setLoading(false);
  };

  const handleOfflineLogin = async () => {
    const name = offlineName.trim() || 'Player';
    await window.electronAPI.accounts.loginOffline(name);
    await loadAccounts();
    onRefresh();
    setOfflineName('');
  };

  const handleRemove = async (uuid: string) => {
    await window.electronAPI.accounts.remove(uuid);
    await loadAccounts();
    onRefresh();
  };

  const handleSelect = async (uuid: string) => {
    await window.electronAPI.accounts.setCurrent(uuid);
    onRefresh();
    await loadAccounts();
  };

  return (
    <div>
      <div className="view-header">
        <h1>Accounts</h1>
        <p>Manage your accounts</p>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div className="dashboard-play" style={{ flex: 1, marginBottom: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Ely.by Login</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Login with Ely.by for online authentication. If the app isn't registered, set your own Client ID in Settings.
          </p>
          <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>
            {loading ? 'Connecting...' : 'Login with Ely.by'}
          </button>
          {error && <p className="error-text">{error}</p>}
        </div>

        <div className="dashboard-play" style={{ flex: 1, marginBottom: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Offline Account</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Play without authentication. Enter any username to play offline.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              placeholder="Username"
              value={offlineName}
              onChange={e => setOfflineName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleOfflineLogin()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleOfflineLogin}>
              Play Offline
            </button>
          </div>
        </div>
      </div>

      <div className="account-list">
        {accounts.map(a => (
          <div
            key={a.uuid}
            className={`account-item ${account?.uuid === a.uuid ? 'active' : ''}`}
          >
            <div className="account-avatar">
              {a.username.charAt(0).toUpperCase()}
            </div>
            <div className="account-info">
              <div className="account-name">
                {a.username}
                {a.offline && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Offline</span>}
              </div>
              <div className="account-uuid">{a.uuid.slice(0, 8)}...</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {account?.uuid !== a.uuid && (
                <button className="btn btn-secondary" onClick={() => handleSelect(a.uuid)}>
                  Switch
                </button>
              )}
              <button className="btn btn-danger" onClick={() => handleRemove(a.uuid)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
