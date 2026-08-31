/**
 * IndexedDB Local-First Persistence & Offline Sync Engine
 * 
 * Provides resilient offline caching, queuing of transactions captured while offline,
 * and automatic synchronization with Firestore when network connectivity is restored.
 */

import { doc, setDoc, collection } from 'firebase/firestore';
import { db, auth, isFirestoreAvailable } from './firebase';

const DB_NAME = 'CoinbaseLocalLedgerDB';
const DB_VERSION = 1;

export interface QueuedTransaction {
  id: string;
  txData: any;
  userEmail?: string;
  capturedAt: number;
  retryCount: number;
  status: 'QUEUED_OFFLINE' | 'SYNC_FAILED' | 'SYNCING';
  lastError?: string;
}

export interface CachedTransaction {
  id: string;
  txData: any;
  syncedWithFirestore: boolean;
  updatedAt: number;
}

export interface SyncStats {
  isOnline: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  totalCached: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;
const syncListeners = new Set<(stats: SyncStats) => void>();

/**
 * Initializes and returns the IndexedDB instance
 */
export function getLocalDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const idb = (event.target as IDBOpenDBRequest).result;

      // 1. Offline Queue Store: for items waiting to sync to Firestore
      if (!idb.objectStoreNames.contains('offline_queue')) {
        const queueStore = idb.createObjectStore('offline_queue', { keyPath: 'id' });
        queueStore.createIndex('capturedAt', 'capturedAt', { unique: false });
        queueStore.createIndex('status', 'status', { unique: false });
      }

      // 2. Local Transactions Cache Store: local-first source of truth
      if (!idb.objectStoreNames.contains('local_transactions_cache')) {
        const cacheStore = idb.createObjectStore('local_transactions_cache', { keyPath: 'id' });
        cacheStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        cacheStore.createIndex('syncedWithFirestore', 'syncedWithFirestore', { unique: false });
      }

      // 3. Sync Metadata Store: timestamps, health status, sync tokens
      if (!idb.objectStoreNames.contains('sync_metadata')) {
        idb.createObjectStore('sync_metadata', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.warn('[IndexedDB Init Error]:', request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Persists a transaction locally to IndexedDB and enqueues for Firestore sync
 */
export async function queueOfflineTransaction(txData: any, userEmail?: string): Promise<QueuedTransaction> {
  const idb = await getLocalDB();
  const txId = txData.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const queuedItem: QueuedTransaction = {
    id: txId,
    txData: { ...txData, id: txId },
    userEmail: userEmail || localStorage.getItem('cb_auth_email') || 'anonymous',
    capturedAt: Date.now(),
    retryCount: 0,
    status: 'QUEUED_OFFLINE'
  };

  return new Promise((resolve, reject) => {
    const transaction = idb.transaction(['offline_queue', 'local_transactions_cache'], 'readwrite');
    const queueStore = transaction.objectStore('offline_queue');
    const cacheStore = transaction.objectStore('local_transactions_cache');

    queueStore.put(queuedItem);
    cacheStore.put({
      id: txId,
      txData: queuedItem.txData,
      syncedWithFirestore: false,
      updatedAt: Date.now()
    });

    transaction.oncomplete = () => {
      notifySyncListeners();
      resolve(queuedItem);
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

/**
 * Retrieves all pending offline queued transactions from IndexedDB
 */
export async function getPendingOfflineTransactions(): Promise<QueuedTransaction[]> {
  try {
    const idb = await getLocalDB();
    return new Promise((resolve) => {
      const transaction = idb.transaction('offline_queue', 'readonly');
      const store = transaction.objectStore('offline_queue');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Removes a successfully synced transaction from the offline queue
 */
export async function removeQueuedTransaction(id: string): Promise<void> {
  try {
    const idb = await getLocalDB();
    return new Promise((resolve) => {
      const transaction = idb.transaction(['offline_queue', 'local_transactions_cache'], 'readwrite');
      const queueStore = transaction.objectStore('offline_queue');
      const cacheStore = transaction.objectStore('local_transactions_cache');

      queueStore.delete(id);
      
      // Update cache status to synced
      const getReq = cacheStore.get(id);
      getReq.onsuccess = () => {
        if (getReq.result) {
          cacheStore.put({
            ...getReq.result,
            syncedWithFirestore: true,
            updatedAt: Date.now()
          });
        }
      };

      transaction.oncomplete = () => {
        notifySyncListeners();
        resolve();
      };
      transaction.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[IndexedDB remove error]:', err);
  }
}

/**
 * Caches a batch of transactions into IndexedDB for instant offline access
 */
export async function cacheTransactionsLocally(txs: any[]): Promise<void> {
  if (!Array.isArray(txs) || txs.length === 0) return;
  try {
    const idb = await getLocalDB();
    const transaction = idb.transaction('local_transactions_cache', 'readwrite');
    const store = transaction.objectStore('local_transactions_cache');

    for (const tx of txs) {
      if (tx && tx.id) {
        store.put({
          id: tx.id,
          txData: tx,
          syncedWithFirestore: true,
          updatedAt: Date.now()
        });
      }
    }
  } catch (err) {
    console.warn('[IndexedDB cache error]:', err);
  }
}

/**
 * Retrieves all cached transactions from IndexedDB
 */
export async function getCachedTransactions(): Promise<any[]> {
  try {
    const idb = await getLocalDB();
    return new Promise((resolve) => {
      const transaction = idb.transaction('local_transactions_cache', 'readonly');
      const store = transaction.objectStore('local_transactions_cache');
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // Return latest first
        resolve(results.map((r: CachedTransaction) => r.txData));
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Saves a transaction using local-first IndexedDB persistence with immediate or deferred Firestore sync
 */
export async function saveTransactionWithOfflineFallback(
  tx: any, 
  userEmail?: string
): Promise<{ success: boolean; queuedLocally: boolean; syncedToFirestore: boolean; id: string }> {
  const txId = tx.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const cleanTx = { ...tx, id: txId };
  const email = userEmail || localStorage.getItem('cb_auth_email') || 'anonymous';

  // 1. Immediately write to IndexedDB local cache first
  try {
    const idb = await getLocalDB();
    const transaction = idb.transaction('local_transactions_cache', 'readwrite');
    const store = transaction.objectStore('local_transactions_cache');
    store.put({
      id: txId,
      txData: cleanTx,
      syncedWithFirestore: false,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.warn('[IndexedDB direct write warning]:', err);
  }

  // 2. If browser is offline, queue into IndexedDB offline_queue immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await queueOfflineTransaction(cleanTx, email);
    return {
      success: true,
      queuedLocally: true,
      syncedToFirestore: false,
      id: txId
    };
  }

  // 3. If online and Firestore is provisioned, attempt direct Firestore sync
  if (isFirestoreAvailable) {
    try {
      const docId = `backup_${String(txId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const docRef = doc(collection(db, 'ledger_backups'), docId);
      
      // Timeout Firestore call after 2.5 seconds to gracefully fallback to IndexedDB
      await Promise.race([
        setDoc(docRef, {
          userId: auth.currentUser?.uid || email,
          txId: txId,
          amount: Number(cleanTx.amount || cleanTx.fiatAmount || 0),
          currency: cleanTx.assetSymbol || 'USD',
          type: cleanTx.type || 'TRANSFER',
          status: cleanTx.status || 'COMPLETED',
          description: cleanTx.details || cleanTx.description || 'Transaction',
          metadata: cleanTx,
          createdAt: new Date(cleanTx.timestamp || Date.now()).toISOString(),
          syncedAt: new Date().toISOString()
        }, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore sync timeout')), 2500))
      ]);

      // Mark as synced in local cache
      try {
        const idb = await getLocalDB();
        const transaction = idb.transaction('local_transactions_cache', 'readwrite');
        const store = transaction.objectStore('local_transactions_cache');
        store.put({
          id: txId,
          txData: cleanTx,
          syncedWithFirestore: true,
          updatedAt: Date.now()
        });
        await recordSyncTimestamp();
      } catch {}

      return {
        success: true,
        queuedLocally: false,
        syncedToFirestore: true,
        id: txId
      };
    } catch (firestoreErr) {
      // On sync failure or timeout, queue to IndexedDB for automatic re-sync
      await queueOfflineTransaction(cleanTx, email);
      return {
        success: true,
        queuedLocally: true,
        syncedToFirestore: false,
        id: txId
      };
    }
  }

  // If Firestore is not enabled, transaction is safely stored in local IndexedDB
  return {
    success: true,
    queuedLocally: false,
    syncedToFirestore: false,
    id: txId
  };
}

/**
 * Flushes all pending transactions from IndexedDB offline queue to Firestore
 */
let isFlushingQueue = false;
export async function syncOfflineQueueToFirestore(): Promise<{
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}> {
  if (isFlushingQueue) {
    return { total: 0, synced: 0, failed: 0, errors: ['Sync already in progress'] };
  }

  if (!isFirestoreAvailable) {
    return { total: 0, synced: 0, failed: 0, errors: [] };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { total: 0, synced: 0, failed: 0, errors: ['Device is offline'] };
  }

  isFlushingQueue = true;
  const pending = await getPendingOfflineTransactions();
  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  if (pending.length === 0) {
    isFlushingQueue = false;
    return { total: 0, synced: 0, failed: 0, errors: [] };
  }

  for (const item of pending) {
    try {
      const tx = item.txData;
      const txId = item.id;
      const docId = `backup_${String(txId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const docRef = doc(collection(db, 'ledger_backups'), docId);

      await setDoc(docRef, {
        userId: auth.currentUser?.uid || item.userEmail || 'anonymous',
        txId: txId,
        amount: Number(tx.amount || tx.fiatAmount || 0),
        currency: tx.assetSymbol || 'USD',
        type: tx.type || 'TRANSFER',
        status: tx.status || 'COMPLETED',
        description: tx.details || tx.description || 'Offline Queued Transaction',
        metadata: tx,
        createdAt: new Date(tx.timestamp || item.capturedAt).toISOString(),
        syncedAt: new Date().toISOString(),
        reSyncedFromOfflineQueue: true
      }, { merge: true });

      // Remove from queue and mark synced in IndexedDB cache
      await removeQueuedTransaction(txId);
      synced++;
    } catch (err: any) {
      failed++;
      errors.push(`Failed to sync ${item.id}: ${err?.message || err}`);
      
      // Update retry count in IndexedDB
      try {
        const idb = await getLocalDB();
        const transaction = idb.transaction('offline_queue', 'readwrite');
        const store = transaction.objectStore('offline_queue');
        store.put({
          ...item,
          retryCount: (item.retryCount || 0) + 1,
          status: 'SYNC_FAILED',
          lastError: err?.message || 'Sync failed'
        });
      } catch {}
    }
  }

  if (synced > 0) {
    await recordSyncTimestamp();
  }

  isFlushingQueue = false;
  notifySyncListeners();

  return {
    total: pending.length,
    synced,
    failed,
    errors
  };
}

/**
 * Records last sync timestamp into IndexedDB
 */
async function recordSyncTimestamp(): Promise<void> {
  try {
    const idb = await getLocalDB();
    const transaction = idb.transaction('sync_metadata', 'readwrite');
    const store = transaction.objectStore('sync_metadata');
    store.put({
      key: 'last_successful_sync',
      value: new Date().toISOString()
    });
  } catch {}
}

/**
 * Returns sync statistics and pending queue count
 */
export async function getOfflineSyncStats(): Promise<SyncStats> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const pending = await getPendingOfflineTransactions();
  
  let lastSyncedAt: string | null = null;
  let totalCached = 0;

  try {
    const idb = await getLocalDB();
    
    // Get last synced timestamp
    const metaTx = idb.transaction('sync_metadata', 'readonly');
    const metaStore = metaTx.objectStore('sync_metadata');
    const metaReq = metaStore.get('last_successful_sync');
    
    await new Promise<void>((resolve) => {
      metaReq.onsuccess = () => {
        if (metaReq.result) {
          lastSyncedAt = metaReq.result.value;
        }
        resolve();
      };
      metaReq.onerror = () => resolve();
    });

    // Count cached transactions
    const cacheTx = idb.transaction('local_transactions_cache', 'readonly');
    const cacheStore = cacheTx.objectStore('local_transactions_cache');
    const countReq = cacheStore.count();

    await new Promise<void>((resolve) => {
      countReq.onsuccess = () => {
        totalCached = countReq.result || 0;
        resolve();
      };
      countReq.onerror = () => resolve();
    });
  } catch {}

  return {
    isOnline,
    pendingCount: pending.length,
    lastSyncedAt,
    totalCached
  };
}

/**
 * Subscribes to sync status changes
 */
export function subscribeToSyncStats(callback: (stats: SyncStats) => void): () => void {
  syncListeners.add(callback);
  getOfflineSyncStats().then(callback);

  return () => {
    syncListeners.delete(callback);
  };
}

async function notifySyncListeners() {
  const stats = await getOfflineSyncStats();
  for (const listener of syncListeners) {
    try {
      listener(stats);
    } catch {}
  }
}

/**
 * Auto-initialize online / offline event listeners and periodic sync scheduler
 */
if (typeof window !== 'undefined') {
  // Listen for network connectivity restoration
  window.addEventListener('online', () => {
    console.log('[IndexedDB Offline Engine] Network online restored. Triggering auto-resync...');
    notifySyncListeners();
    syncOfflineQueueToFirestore();
  });

  window.addEventListener('offline', () => {
    console.log('[IndexedDB Offline Engine] Network offline. Transactions will queue in IndexedDB.');
    notifySyncListeners();
  });

  // Background interval check every 30 seconds to flush any pending queue if online
  setInterval(() => {
    if (navigator.onLine && !isFlushingQueue) {
      getPendingOfflineTransactions().then((items) => {
        if (items.length > 0) {
          syncOfflineQueueToFirestore();
        }
      });
    }
  }, 30000);
}
