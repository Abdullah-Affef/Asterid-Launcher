import { useRef, useEffect, useCallback, useState } from 'react';
import { useModrinthSearch, ModrinthProject } from '../hooks/useModrinthSearch';
import type { LauncherSettings } from '../types';

interface Props {
  projectType: string;
  title: string;
  description: string;
  emptyIcon: string;
  settings: LauncherSettings | null;
  addLog: (msg: string) => void;
  instanceId?: string;
}

function SkeletonGrid() {
  return (
    <div className="recommendations-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton-horizontal" style={{ display: 'flex', gap: 14, padding: 12, alignItems: 'center' }}>
          <div className="skeleton-icon-horizontal" />
          <div style={{ flex: 1 }}>
            <div className="skeleton-line mid" />
            <div className="skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectCard({ project, mcVersion, loader, projectType, addLog, instanceId }: { project: ModrinthProject; mcVersion: string; loader: string; projectType: string; addLog: (msg: string) => void; instanceId?: string }) {
  const [state, setState] = useState<'idle' | 'fetching' | 'downloading' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');

  const handleInstall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setState('fetching');
    setErr('');
    addLog(`[${project.title}] Looking up version info...`);
    const res = instanceId
      ? await window.electronAPI.modrinth.downloadToInstance(project.project_id, mcVersion, loader, projectType, instanceId)
      : await window.electronAPI.modrinth.download(project.project_id, mcVersion, loader, projectType);
    if (res.success) {
      setState('done');
      addLog(`[${project.title}] Installed ${res.filename}`);
      setTimeout(() => setState('idle'), 3000);
    } else {
      const errText = res.error || 'Download failed';
      setState('error');
      addLog(`[${project.title}] Failed: ${errText}`);
      setErr(errText);
      setTimeout(() => setState('idle'), 4000);
    }
  };

  const btnLabel = state === 'fetching' ? '⏳' : state === 'downloading' ? '⬇' : state === 'done' ? '✓' : state === 'error' ? '✕' : 'Install';
  const btnStyle: React.CSSProperties = state === 'done' ? { background: 'var(--success)', color: '#fff' } :
    state === 'error' ? { background: 'var(--danger)', color: '#fff' } : {};

  return (
    <div className="modrinth-card modrinth-card-horizontal" onClick={() => window.open(`https://modrinth.com/${project.project_type}/${project.slug}`, '_blank')}>
      <div className="modrinth-card-icon">
        {project.icon_url ? (
          <img src={project.icon_url} alt={project.title} loading="lazy" />
        ) : (
          <span style={{ fontSize: 24 }}>📦</span>
        )}
      </div>
      <div className="modrinth-card-body">
        <div className="modrinth-card-title">{project.title}</div>
        <div className="modrinth-card-author">{project.author}</div>
        <div className="modrinth-card-desc">{project.description?.slice(0, 120)}{project.description?.length > 120 ? '...' : ''}</div>
        {err && <div style={{ fontSize: 10, color: 'var(--danger)', marginBottom: 4 }}>{err}</div>}
        <div className="modrinth-card-footer">
          <span className="modrinth-card-downloads">
            {project.downloads >= 1000
              ? `${(project.downloads / 1000).toFixed(1)}k`
              : project.downloads} downloads
          </span>
          <button
            className="modrinth-card-btn"
            onClick={handleInstall}
            disabled={state === 'fetching' || state === 'downloading'}
            style={btnStyle}
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModrinthBrowser({ projectType, title, description, emptyIcon, settings, addLog, instanceId }: Props) {
  const mcVersion = settings?.selectedVersion || '';
  const loader = settings?.loader || 'vanilla';
  const { projects, loading, initialLoading, hasMore, error, doSearch, loadMore } = useModrinthSearch(projectType, mcVersion, loader);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(() => {
    const q = inputRef.current?.value || '';
    doSearch(q);
  }, [doSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, hasMore, loadMore]);

  return (
    <div>
      <div className="view-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="search-bar">
        <input
          ref={inputRef}
          className="search-input"
          placeholder={`Search ${title.toLowerCase()}...`}
          onKeyDown={handleKeyDown}
        />
        <button className="btn btn-primary" onClick={handleSearch}>Search</button>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

      {initialLoading ? (
        <SkeletonGrid />
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <span style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>{emptyIcon}</span>
          <h3>No {title.toLowerCase()} found</h3>
          <p>Try a different search term</p>
        </div>
      ) : (
        <>
          <div className="recommendations-grid">
            {projects.map(p => (
              <ProjectCard key={p.project_id} project={p} mcVersion={mcVersion} loader={loader} projectType={projectType} addLog={addLog} instanceId={instanceId} />
            ))}
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <div key={`skel-${i}`} className="skeleton">
                <div className="skeleton-icon" />
                <div className="skeleton-line mid" />
                <div className="skeleton-line short" />
              </div>
            ))}
          </div>
          <div ref={sentinelRef} className="scroll-sentinel">
            {loading ? 'Loading...' : hasMore ? '' : 'All projects loaded'}
          </div>
        </>
      )}
    </div>
  );
}
