import type { Tab } from '../App';
import type { Account } from '../types';
import { HiCube, HiHome, HiVariable, HiPaintBrush, HiSparkles, HiCog6Tooth, HiUser } from 'react-icons/hi2';
import logo from '../../images/logo.png';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  account: Account | null;
  selectedInstanceId: string | null;
}

const mainTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'instances', label: 'Instances', icon: <HiCube /> },
  { id: 'dashboard', label: 'Dashboard', icon: <HiHome /> },
];

const instanceTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'mods', label: 'Mods', icon: <HiVariable /> },
  { id: 'resourcepacks', label: 'Resource Packs', icon: <HiPaintBrush /> },
  { id: 'shaders', label: 'Shaders', icon: <HiSparkles /> },
  { id: 'modpacks', label: 'Modpacks', icon: <HiCube /> },
];

const bottomTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'settings', label: 'Settings', icon: <HiCog6Tooth /> },
  { id: 'accounts', label: 'Accounts', icon: <HiUser /> },
];

export function Sidebar({ activeTab, onTabChange, account, selectedInstanceId }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={logo} alt="Asterid" style={{ height: 24, width: 'auto', objectFit: 'contain', borderRadius: 4 }} />
        Asterid
      </div>
      <nav className="sidebar-nav">
        {mainTabs.map(tab => (
          <button
            key={tab.id}
            className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="sidebar-item-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
        {selectedInstanceId && (
          <>
            <div className="sidebar-section-label">Instance</div>
            {instanceTabs.map(tab => (
              <button
                key={tab.id}
                className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                <span className="sidebar-item-icon">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </>
        )}
        {bottomTabs.map(tab => (
          <button
            key={tab.id}
            className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="sidebar-item-icon">{tab.icon}</span>
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
