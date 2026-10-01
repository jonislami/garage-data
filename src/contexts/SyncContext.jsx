import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui';

const SyncContext = createContext();
const STORAGE_KEY = 'sonic_sync_queue';

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || []; } catch { return []; }
}

export function SyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // The queue lives in a ref so several addToQueue calls in a row (a job + its lines)
  // all land in it; the state copy only drives re-renders.
  const queueRef = useRef(loadQueue());
  const [syncQueue, setSyncQueue] = useState(queueRef.current);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const persist = useCallback(next => {
    queueRef.current = next;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage full or blocked */ }
    setSyncQueue(next);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Add a change to the waiting room. Inserts get a fixed id now, so sending them
  // again (retry, second tab, flaky connection) can never create a duplicate row.
  const addToQueue = useCallback((table, action, payload) => {
    const body = action === 'INSERT' && !payload.id ? { ...payload, id: crypto.randomUUID() } : payload;
    const item = { id: crypto.randomUUID(), table, action, payload: body, timestamp: new Date().toISOString() };
    persist([...queueRef.current, item]);
    return true;
  }, [persist]);

  // Push the waiting room to Supabase, one item at a time, oldest first. Only one run at a time.
  const processQueue = useCallback(async ({ silent = false } = {}) => {
    if (syncingRef.current || queueRef.current.length === 0) return;
    syncingRef.current = true;
    setIsSyncing(true);
    const batch = [...queueRef.current];
    let failed = 0;

    for (const item of batch) {
      try {
        let error;
        if (item.action === 'INSERT') {
          ({ error } = await supabase.from(item.table)
            .upsert(item.payload, { onConflict: 'id', ignoreDuplicates: true }));
        } else if (item.action === 'UPDATE') {
          ({ error } = await supabase.from(item.table).update(item.payload).eq('id', item.payload.id));
        } else if (item.action === 'DELETE') {
          ({ error } = await supabase.from(item.table).delete().eq('id', item.payload.id));
        }
        if (error) throw error;
        // Remove just this item (others may have been added meanwhile)
        persist(queueRef.current.filter(q => q.id !== item.id));
      } catch (error) {
        console.error('Sync failed for item', item, error);
        failed++;
      }
    }

    syncingRef.current = false;
    setIsSyncing(false);
    if (failed === 0) toastRef.current.success('Back online — all offline changes have been synced.');
    else if (!silent) toastRef.current.error(`${failed} offline change${failed === 1 ? '' : 's'} could not be synced yet; will retry.`);
  }, [persist]);

  // Sync when the connection comes back, and whenever new items arrive while online
  useEffect(() => {
    if (isOnline && syncQueue.length > 0) processQueue();
  }, [isOnline, syncQueue.length, processQueue]);

  // Quietly retry anything that failed, once a minute while online
  useEffect(() => {
    if (!isOnline) return undefined;
    const t = setInterval(() => { if (queueRef.current.length) processQueue({ silent: true }); }, 60000);
    return () => clearInterval(t);
  }, [isOnline, processQueue]);

  return (
    <SyncContext.Provider value={{ isOnline, syncQueue, addToQueue, processQueue, isSyncing }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);
