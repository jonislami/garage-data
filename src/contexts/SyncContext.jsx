import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui';

const SyncContext = createContext();

export function SyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const toast = useToast();

  // 1. Load the queue from the phone's local memory on boot
  useEffect(() => {
    const savedQueue = localStorage.getItem('sonic_sync_queue');
    if (savedQueue) {
      setSyncQueue(JSON.parse(savedQueue));
    }

    // 2. Listen for Wi-Fi turning on and off
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 3. Automatically process the queue when internet comes back!
  useEffect(() => {
    if (isOnline && syncQueue.length > 0 && !isSyncing) {
      processQueue();
    }
  }, [isOnline, syncQueue]);

  // Function to add a task to the Waiting Room
  const addToQueue = (table, action, payload) => {
    const newItem = { 
      id: Date.now().toString(), 
      table, 
      action, 
      payload, 
      timestamp: new Date().toISOString() 
    };
    const newQueue = [...syncQueue, newItem];
    setSyncQueue(newQueue);
    localStorage.setItem('sonic_sync_queue', JSON.stringify(newQueue));
    return true; 
  };

  // Function that pushes the Waiting Room to Supabase
  const processQueue = async () => {
    setIsSyncing(true);
    let currentQueue = [...syncQueue];
    let failedItems = [];

    for (const item of currentQueue) {
      try {
        if (item.action === 'INSERT') {
           const { error } = await supabase.from(item.table).insert([item.payload]);
           if (error) throw error;
        } else if (item.action === 'UPDATE') {
           const { error } = await supabase.from(item.table).update(item.payload).eq('id', item.payload.id);
           if (error) throw error;
        } else if (item.action === 'DELETE') {
           const { error } = await supabase.from(item.table).delete().eq('id', item.payload.id);
           if (error) throw error;
        }
      } catch (error) {
        console.error('Sync failed for item', item, error);
        failedItems.push(item); // Keep it in the queue if it fails again
      }
    }

    // Clear the queue of successful items
    setSyncQueue(failedItems);
    localStorage.setItem('sonic_sync_queue', JSON.stringify(failedItems));
    setIsSyncing(false);
    
    if (failedItems.length === 0 && currentQueue.length > 0) {
      toast.success('Back online — all offline changes have been synced.');
    }
  };

  return (
    <SyncContext.Provider value={{ isOnline, syncQueue, addToQueue, processQueue, isSyncing }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);