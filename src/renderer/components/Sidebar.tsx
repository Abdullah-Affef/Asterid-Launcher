import type { Tab } from '../App';
import type { Account } from '../types';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  account: Account | null;
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'mods', label: 'Mods', icon: '⚡' },
  { id: 'resourcepacks', label: 'Resource Packs', icon: '◆' },
  { id: 'shaders', label: 'Shaders', icon: '✦' },
  { id: 'modpacks', label: 'Modpacks', icon: '▣' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'accounts', label: 'Accounts', icon: '👤' },
];

export function Sidebar({ activeTab, onTabChange, account }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
          <line x1="12" y1="12" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
        Launcher
      </div>
      <nav className="sidebar-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-account">
        <button className="sidebar-account-btn" onClick={() => onTabChange('accounts')}>
          {account ? (
            <>
              <div className="sidebar-account-avatar">
                {account.username.charAt(0).toUpperCase()}
              </div>
              <div className="sidebar-account-info">
                <div className="sidebar-account-name">{account.username}</div>
                <div className="sidebar-account-status">Connected</div>
              </div>
            </>
          ) : (
            <>
              <div className="sidebar-account-avatar" style={{ fontSize: '16px' }}>?</div>
              <div className="sidebar-account-info">
                <div className="sidebar-account-name">No account</div>
                <div className="sidebar-account-status">Click to login</div>
              </div>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
