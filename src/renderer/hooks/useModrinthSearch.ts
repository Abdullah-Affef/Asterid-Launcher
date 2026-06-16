import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'https://api.modrinth.com/v2';

export interface ModrinthProject {
  project_id: string;
  title: string;
  slug: string;
  description: string;
  author: string;
  icon_url: string;
  downloads: number;
  project_type: string;
  categories: string[];
  latest_version: string;
  client_side: string;
  server_side: string;
}

interface SearchResult {
  hits: ModrinthProject[];
  total_hits: number;
  offset: number;
  limit: number;
}

export function useModrinthSearch(projectType: string, mcVersion: string, loader: string, initialQuery = '') {
  const [projects, setProjects] = useState<ModrinthProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState(initialQuery);
  const [offset, setOffset] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (searchQuery: string, searchOffset: number, append: boolean) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');

    try {
      const facets: string[][] = [[`project_type:${projectType}`]];
      const versionFilterTypes = ['mod', 'modpack'];
      if (mcVersion && mcVersion !== 'latest_release' && mcVersion !== 'latest_snapshot' && versionFilterTypes.includes(projectType)) {
        facets.push([`versions:${mcVersion}`]);
      }
      if (loader && loader !== 'vanilla' && versionFilterTypes.includes(projectType)) {
        facets.push([`categories:${loader}`]);
      }
      const params = new URLSearchParams({
        limit: '20',
        offset: String(searchOffset),
        facets: JSON.stringify(facets),
      });
      if (searchQuery) params.set('query', searchQuery);

      const res = await fetch(`${API_BASE}/search?${params}`, {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('Search failed');
      const data: SearchResult = await res.json();

      if (controller.signal.aborted) return;

      if (append) {
        setProjects(prev => [...prev, ...data.hits]);
      } else {
        setProjects(data.hits);
      }
      setHasMore(data.hits.length === 20);
      setOffset(searchOffset + data.hits.length);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message || 'Failed to search');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [projectType]);

  const fetchRecommendations = useCallback(async () => {
    setInitialLoading(true);
    await search('', 0, false);
  }, [search]);

  const doSearch = useCallback(async (q: string) => {
    setQuery(q);
    setProjects([]);
    setOffset(0);
    setHasMore(true);
    setInitialLoading(true);
    await search(q, 0, false);
  }, [search]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    await search(query, offset, true);
  }, [loading, hasMore, query, offset, search]);

  useEffect(() => {
    fetchRecommendations();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchRecommendations]);

  return {
    projects,
    loading,
    initialLoading,
    hasMore,
    query,
    error,
    doSearch,
    loadMore,
  };
}
