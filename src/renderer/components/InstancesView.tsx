import { useState, useEffect, useRef } from 'react';
import type { Instance, Account, VersionManifest } from '../types';
import { ModrinthBrowser } from './ModrinthBrowser';

interface Props {
  account: Account | null;
  versions: VersionManifest | null;
  logs: string[];
  onClearLogs: () => void;
  addLog: (msg: string) => void;
  onSelectInstance: (instance: Instance | null) => void;
}

type ViewMode = 'list' | 'create' | 'edit' | 'detail';

export function InstancesView({ account, versions, logs, onClearLogs, addLog, onSelectInstance }: Props) {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [mode, setMode] = useState<ViewMode>('list');
  const [selected, setSelected] = useState<Instance | null>(null);
  const [launching, setLaunching] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({ name: '', version: '', loader: 'vanilla' as 'vanilla' | 'fabric', minRam: 2, maxRam: 4, javaPath: '' });

  useEffect(() => {
    loadInstances();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (selected) {
      const updated = instances.find(i => i.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [instances]);

  const loadInstances = async () => {
    const list = await window.electronAPI.instances.list();
    setInstances(list);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Instance name is required'); return; }
    if (!form.version) { setError('Please select a version'); return; }
    setError('');
    await window.electronAPI.instances.create({ name: form.name.trim(), version: form.version, loader: form.loader, minRam: form.minRam, maxRam: form.maxRam, javaPath: form.javaPath });
    setForm({ name: '', version: '', loader: 'vanilla', minRam: 2, maxRam: 4, javaPath: '' });
    setMode('list');
    await loadInstances();
    addLog(`Created instance "${form.name}"`);
  };

  const handleEdit = async () => {
    if (!selected) return;
    if (!form.name.trim()) { setError('Instance name is required'); return; }
    await window.electronAPI.instances.update(selected.id, {
      name: form.name.trim(),
      version: form.version,
      loader: form.loader,
      minRam: form.minRam,
      maxRam: form.maxRam,
      javaPath: form.javaPath,
    });
    setMode('detail');
    await loadInstances();
    addLog(`Updated instance "${form.name}"`);
  };

  const handleDelete = async (id: string) => {
    const inst = instances.find(i => i.id === id);
    if (!inst) return;
    if (!confirm(`Delete "${inst.name}"? All mods, saves, and config will be removed.`)) return;
    await window.electronAPI.instances.delete(id);
    if (selected?.id === id) { setSelected(null); onSelectInstance(null); }
    await loadInstances();
    addLog(`Deleted instance "${inst.name}"`);
  };

  const handlePlay = async (instance: Instance) => {
    if (!account) { setError('Please login first'); return; }

    if (running) {
      addLog('Stopping Minecraft...');
      await window.electronAPI.minecraft.kill();
      setRunning(false);
      return;
    }

    setLaunching(true);
    setError('');

    addLog(`Launching instance "${instance.name}" (${instance.version}, ${instance.loader})...`);
    const result = await window.electronAPI.minecraft.launchInstance(instance, account);
    setLaunching(false);

    if (result.success) {
      addLog('Minecraft launched successfully');
      setRunning(true);
      await window.electronAPI.instances.update(instance.id, { lastPlayed: Date.now() });
      await loadInstances();
      setTimeout(async () => {
        const stillRunning = await window.electronAPI.minecraft.isRunning();
        setRunning(stillRunning);
      }, 1000);
    } else {
      const errMsg = result.error || 'Failed to launch';
      addLog(`Error: ${errMsg}`);
      setError(errMsg);
    }
  };

  const openCreate = () => {
    setForm({
      name: '',
      version: versions?.latest?.release || '',
      loader: 'vanilla',
      minRam: 2,
      maxRam: 4,
      javaPath: '',
    });
    setMode('create');
    setError('');
  };

  const openEdit = (instance: Instance) => {
    setForm({ name: instance.name, version: instance.version, loader: instance.loader, minRam: instance.minRam, maxRam: instance.maxRam, javaPath: instance.javaPath });
    setMode('edit');
    setError('');
  };

  const openDetail = (instance: Instance) => {
    setSelected(instance);
    setMode('detail');
    setError('');
    onSelectInstance(instance);
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString();

  const renderList = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Instances</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Separate Minecraft environments with their own mods and settings
          </p>
        </div>
        <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={openCreate}>+ New Instance</button>
      </div>

      {instances.length === 0 ? (
        <div className="empty-state" style={{ padding: '48px 24px' }}>
          <span style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>📦</span>
          <h3>No instances yet</h3>
          <p>Create your first instance to get started</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openCreate}>Create Instance</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {instances.map(inst => (
            <div
              key={inst.id}
              className="instance-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                background: selected?.id === inst.id ? 'var(--accent-dim)' : 'var(--bg-card)',
                border: selected?.id === inst.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onClick={() => openDetail(inst)}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 8,
                background: inst.loader === 'fabric' ? 'linear-gradient(135deg, #db7c2f, #b06b1a)' : 'linear-gradient(135deg, #3a3a3a, #2a2a2a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {inst.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{inst.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {inst.loader !== 'vanilla' ? `${inst.loader.charAt(0).toUpperCase() + inst.loader.slice(1)} ` : ''}{inst.version}
                  {inst.lastPlayed ? ` · Last played ${formatDate(inst.lastPlayed)}` : ''}
                </div>
              </div>
              <button
                className="play-btn"
                style={{ padding: '6px 18px', fontSize: 12, flexShrink: 0 }}
                onClick={e => { e.stopPropagation(); handlePlay(inst); }}
                disabled={launching}
              >
                {running ? 'Stop' : 'Play'}
              </button>
              <button
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: 4, fontSize: 16,
                }}
                onClick={e => { e.stopPropagation(); handleDelete(inst.id); }}
                title="Delete instance"
              >🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderForm = (isEdit: boolean) => (
    <div style={{ maxWidth: 480 }}>
      <button
        className="btn btn-secondary"
        style={{ marginBottom: 20 }}
        onClick={() => { setMode(selected ? 'detail' : 'list'); setError(''); }}
      >
        ← Back
      </button>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{isEdit ? 'Edit Instance' : 'New Instance'}</h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
        {isEdit ? 'Modify instance settings' : 'Create a new Minecraft instance'}
      </p>

      <div className="form-group">
        <label className="form-label">Instance Name</label>
        <input
          className="form-input"
          placeholder="My Modded Instance"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Minecraft Version</label>
        {versions ? (
          <select
            className="form-input"
            value={form.version}
            onChange={e => setForm({ ...form, version: e.target.value })}
          >
            <optgroup label="Latest">
              <option value={versions.latest.release}>Release ({versions.latest.release})</option>
              <option value={versions.latest.snapshot}>Snapshot ({versions.latest.snapshot})</option>
            </optgroup>
            <optgroup label="All versions">
              {versions.versions.map(v => (
                <option key={v.id} value={v.id}>{v.id}</option>
              ))}
            </optgroup>
          </select>
        ) : (
          <input className="form-input" value={form.version} readOnly placeholder="Loading versions..." />
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Loader</label>
        <select
          className="form-input"
          value={form.loader}
          onChange={e => setForm({ ...form, loader: e.target.value as 'vanilla' | 'fabric' })}
        >
          <option value="vanilla">Vanilla</option>
          <option value="fabric">Fabric</option>
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Min RAM (GB)</label>
          <input className="form-input" type="number" min="1" max="32" value={form.minRam} onChange={e => setForm({ ...form, minRam: parseInt(e.target.value) || 2 })} />
        </div>
        <div className="form-group">
          <label className="form-label">Max RAM (GB)</label>
          <input className="form-input" type="number" min="1" max="64" value={form.maxRam} onChange={e => setForm({ ...form, maxRam: parseInt(e.target.value) || 4 })} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Java Path (optional)</label>
        <input className="form-input" placeholder="Auto-detect (leave empty)" value={form.javaPath} onChange={e => setForm({ ...form, javaPath: e.target.value })} />
      </div>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

      <button className="btn btn-primary" onClick={isEdit ? handleEdit : handleCreate}>
        {isEdit ? 'Save Changes' : 'Create Instance'}
      </button>
    </div>
  );

  const renderDetail = () => {
    if (!selected) return null;

    return (
      <div>
        <button
          className="btn btn-secondary"
          style={{ marginBottom: 20 }}
          onClick={() => { setMode('list'); setSelected(null); onSelectInstance(null); }}
        >
          ← All Instances
        </button>

        <div className="dashboard-play" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12,
              background: selected.loader === 'fabric' ? 'linear-gradient(135deg, #db7c2f, #b06b1a)' : 'linear-gradient(135deg, #3a3a3a, #2a2a2a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {selected.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>{selected.name}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {selected.loader !== 'vanilla' ? `${selected.loader.charAt(0).toUpperCase() + selected.loader.slice(1)} ` : ''}{selected.version}
                {selected.lastPlayed ? ` · Last played ${formatDate(selected.lastPlayed)}` : ' · Never played'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => openEdit(selected)}>Edit</button>
              <button
                className={`play-btn ${running ? 'playing' : ''}`}
                onClick={() => handlePlay(selected)}
                disabled={launching}
              >
                {launching ? 'Launching...' : running ? 'Stop' : 'Play'}
              </button>
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="dashboard-info" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="info-card">
              <div className="info-card-label">Version</div>
              <div className="info-card-value">{selected.loader !== 'vanilla' ? `Fabric ` : ''}{selected.version}</div>
            </div>
            <div className="info-card">
              <div className="info-card-label">Loader</div>
              <div className="info-card-value" style={{ textTransform: 'capitalize' }}>{selected.loader}</div>
            </div>
            <div className="info-card">
              <div className="info-card-label">Memory</div>
              <div className="info-card-value">{selected.minRam}GB - {selected.maxRam}GB</div>
            </div>
            <div className="info-card">
              <div className="info-card-label">Created</div>
              <div className="info-card-value">{formatDate(selected.created)}</div>
            </div>
          </div>
        </div>

        <ModrinthBrowser
          projectType="mod"
          title="Mods"
          description="Browse and install mods from Modrinth directly to this instance"
          emptyIcon="⚡"
          settings={{
            selectedVersion: selected.version,
            loader: selected.loader,
          } as any}
          addLog={addLog}
          instanceId={selected.id}
          key={selected.id}
        />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="view-header">
        <h1>Instances</h1>
        <p>Manage separate Minecraft environments</p>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {mode === 'list' && renderList()}
        {mode === 'create' && renderForm(false)}
        {mode === 'edit' && renderForm(true)}
        {mode === 'detail' && renderDetail()}
      </div>

      <div className="log-panel" style={{ flexShrink: 0, minHeight: 140, maxHeight: 200 }}>
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
