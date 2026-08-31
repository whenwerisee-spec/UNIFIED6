import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Wifi, 
  WifiOff, 
  ArrowUpRight,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  getOfflineSyncStats, 
  subscribeToSyncStats, 
  syncOfflineQueueToFirestore, 
  getPendingOfflineTransactions,
  QueuedTransaction,
  SyncStats,
  saveTransactionWithOfflineFallback
} from '../lib/indexeddb-offline-sync';

interface OfflineSyncStatusBarProps {
  onSyncComplete?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const OfflineSyncStatusBar: React.FC<OfflineSyncStatusBarProps> = React.memo(({
  onSyncComplete,
  showToast
}) => {
  const [stats, setStats] = useState<SyncStats>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    lastSyncedAt: null,
    totalCached: 0
  });
  const [pendingItems, setPendingItems] = useState<QueuedTransaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showQueueDetails, setShowQueueDetails] = useState(false);
  const [syncResultMsg, setSyncResultMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSyncStats((newStats) => {
      setStats(newStats);
      if (newStats.pendingCount > 0) {
        getPendingOfflineTransactions().then(setPendingItems);
      } else {
        setPendingItems([]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncResultMsg(null);
    try {
      const result = await syncOfflineQueueToFirestore();
      if (result.synced > 0) {
        const msg = `Synced ${result.synced} offline transaction${result.synced > 1 ? 's' : ''} to Firestore.`;
        setSyncResultMsg(msg);
        if (showToast) {
          showToast(msg, 'success');
        }
      } else if (result.failed > 0) {
        const msg = `Failed to sync ${result.failed} items. Retrying in background.`;
        setSyncResultMsg(msg);
        if (showToast) {
          showToast(msg, 'error');
        }
      } else {
        const msg = stats.isOnline ? 'All transactions are in sync with Firestore.' : 'Cannot sync: Device is offline.';
        setSyncResultMsg(msg);
        if (showToast) {
          showToast(msg, stats.isOnline ? 'info' : 'error');
        }
      }

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: any) {
      setSyncResultMsg(`Sync error: ${err?.message || err}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncResultMsg(null), 5000);
    }
  };

  const handleSimulateOfflineCapture = async () => {
    const dummyTx = {
      id: `sim_offline_${Date.now().toString(36)}`,
      type: 'RECEIVE',
      assetSymbol: 'USD',
      amount: 250,
      fiatAmount: 250,
      timestamp: Date.now(),
      details: 'Authoritative Offline POS Payment (IndexedDB Local Queue)'
    };

    await saveTransactionWithOfflineFallback(dummyTx);
    if (showToast) {
      showToast(
        'Offline Transaction Queued locally in IndexedDB. Will auto-sync when online.', 
        'info'
      );
    }
    const freshStats = await getOfflineSyncStats();
    setStats(freshStats);
    const freshPending = await getPendingOfflineTransactions();
    setPendingItems(freshPending);
  };

  const formattedTime = stats.lastSyncedAt 
    ? new Date(stats.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div id="indexeddb-offline-sync-container" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white space-y-3 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Network & Local-First Status */}
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
            !stats.isOnline 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : stats.pendingCount > 0
              ? 'bg-blue-500/10 border-blue-500/30 text-cyan-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            {!stats.isOnline ? (
              <WifiOff className="w-5 h-5" />
            ) : stats.pendingCount > 0 ? (
              <Database className="w-5 h-5 animate-pulse" />
            ) : (
              <Cloud className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white tracking-wide flex items-center gap-1.5">
                Local-First Persistence (IndexedDB + Firestore)
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                !stats.isOnline
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : stats.pendingCount > 0
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {!stats.isOnline ? 'OFFLINE MODE' : stats.pendingCount > 0 ? `${stats.pendingCount} QUEUED` : 'LIVE SYNCED'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
              <span>IndexedDB Cache: <strong>{stats.totalCached}</strong> records</span>
              <span>•</span>
              <span>Last cloud sync: <strong>{formattedTime || 'Active'}</strong></span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {stats.pendingCount > 0 && (
            <button
              id="view-offline-queue-btn"
              onClick={() => setShowQueueDetails(!showQueueDetails)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1 cursor-pointer"
            >
              <span>Queue ({stats.pendingCount})</span>
              {showQueueDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            id="simulate-offline-tx-btn"
            onClick={handleSimulateOfflineCapture}
            className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-cyan-400 text-xs font-semibold rounded-xl border border-cyan-500/20 transition flex items-center gap-1 cursor-pointer"
            title="Simulate capturing an offline payment in IndexedDB"
          >
            <span>+ Test Queue</span>
          </button>

          <button
            id="trigger-manual-resync-btn"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Firestore'}</span>
          </button>
        </div>
      </div>

      {/* Sync result notification banner */}
      {syncResultMsg && (
        <div className="p-2.5 bg-slate-950 rounded-xl border border-indigo-500/30 text-xs font-mono text-cyan-300 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncResultMsg}</span>
          </div>
          <button 
            onClick={() => setSyncResultMsg(null)}
            className="text-slate-500 hover:text-slate-300 text-xs font-bold px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Expanded Offline Queue Breakdown */}
      {showQueueDetails && pendingItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 font-mono text-xs">
          <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-wider">
            <span>IndexedDB Pending Resync Queue ({pendingItems.length})</span>
            <span className="text-emerald-400">Auto-flushes on reconnect</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {pendingItems.map((item) => {
              const tx = item.txData || {};
              return (
                <div 
                  key={item.id} 
                  className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="overflow-hidden pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white uppercase text-[11px]">{tx.type || 'TX'}</span>
                      <span className="text-cyan-400 font-bold">{tx.assetSymbol || 'USD'} {tx.amount || tx.fiatAmount}</span>
                      <span className="text-[10px] text-slate-500 truncate">({item.id})</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{tx.details || tx.description || 'Offline captured transaction'}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 block">
                      {item.status}
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      {new Date(item.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default OfflineSyncStatusBar;
