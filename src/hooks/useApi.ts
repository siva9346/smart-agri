import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

/**
 * Load data with loading / error / reload state. Refetches whenever the screen
 * regains focus (so edits made on a pushed screen show up on return).
 */
export function useApi<T>(fn: () => Promise<T>, deps: any[] = [], opts: { focus?: boolean } = { focus: true }) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await fnRef.current();
      setData(result);
      setError(null);
      loaded.current = true;
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load('initial'); }, [load]);
  useFocusEffect(useCallback(() => {
    if (opts.focus !== false && loaded.current) load('silent');
  }, [load, opts.focus]));

  return {
    data, setData, loading, refreshing, error,
    reload: () => load(loaded.current ? 'silent' : 'initial'),
    refresh: () => load('refresh'),
  };
}

/** Cursor-paginated list (backend returns {items, nextCursor}). */
export function usePaged<T>(fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string | null }>, deps: any[] = []) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fetchPage);
  fnRef.current = fetchPage;
  const loaded = useRef(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const res = await fnRef.current();
      setItems(res.items);
      setCursor(res.nextCursor);
      setError(null);
      loaded.current = true;
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fnRef.current(cursor);
      setItems(prev => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } catch {
      // keep what we have; user can pull to refresh
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  useEffect(() => { load('initial'); }, [load]);
  useFocusEffect(useCallback(() => { if (loaded.current) load('silent'); }, [load]));

  return { items, setItems, loading, loadingMore, refreshing, error, hasMore: !!cursor,
           reload: () => load('initial'), refresh: () => load('refresh'), loadMore };
}

/** Current user + permission checks (UI only — the backend enforces the same rules). */
export function useAuth() {
  const user = useSelector((s: RootState) => s.auth.user);
  const perms = user?.permissions ?? [];
  return {
    user,
    role: user?.role,
    can: (p: string) => perms.includes(p),
    isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
    isSuper: user?.role === 'SUPER_ADMIN',
    isCustomer: user?.role === 'FARMER',
    isInternal: !!user && user.role !== 'FARMER',
  };
}
