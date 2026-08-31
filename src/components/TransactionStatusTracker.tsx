import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Copy, 
  Check, 
  Zap, 
  Radio, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  ArrowUpRight,
  ArrowDownLeft,
  Timer,
  QrCode
} from 'lucide-react';
import { Transaction } from '../types';

interface TransactionStatusTrackerProps {
  transactions: Transaction[];
  onUpdateAllTransactions?: (txs: Transaction[]) => void;
  onUpdateTransaction?: (tx: Transaction) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  selectedFilter: 'ALL' | 'PENDING' | 'COMPLETED' | 'CRYPTO' | 'FIAT';
  onFilterChange: (filter: 'ALL' | 'PENDING' | 'COMPLETED' | 'CRYPTO' | 'FIAT') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenAtmRecovery?: (tx?: Transaction) => void;
  onOpenQrModal?: (tx: Transaction) => void;
}

export const TransactionStatusTracker: React.FC<TransactionStatusTrackerProps> = React.memo(({
  transactions,
  onUpdateAllTransactions,
  onUpdateTransaction,
  showToast,
  selectedFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onOpenAtmRecovery,
  onOpenQrModal
}) => {
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<Date>(new Date());
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [expandedTrackerId, setExpandedTrackerId] = useState<string | null>(null);
  const [speedingUpId, setSpeedingUpId] = useState<string | null>(null);
  const [networkSyncState, setNetworkSyncState] = useState<{
    mempoolConnected: boolean;
    networkHeight: number;
    avgBlockTimeSec: number;
  }>({
    mempoolConnected: true,
    networkHeight: 894215,
    avgBlockTimeSec: 10
  });

  // Identify active / pending transactions
  const pendingTransactions = transactions.filter(
    (tx) => tx.status === 'pending' || tx.status === 'processing'
  );

  // Poll backend /api/transactions/status for real-time status and confirmation progress
  const pollTransactionStatus = useCallback(async (manual = false) => {
    try {
      setIsPolling(true);
      const res = await fetch('/api/transactions/status', {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setLastPollTime(new Date());
        if (data.activeSyncState) {
          setNetworkSyncState(data.activeSyncState);
        }

        if (Array.isArray(data.transactions) && data.transactions.length > 0) {
          // Merge backend status updates with existing client transactions
          const serverTxMap = new Map<string, any>();
          data.transactions.forEach((tx: any) => serverTxMap.set(tx.id, tx));

          let hasChanges = false;
          const updatedTransactions = transactions.map((localTx) => {
            const serverTx = serverTxMap.get(localTx.id);
            if (serverTx) {
              const statusChanged = localTx.status !== serverTx.status;
              const progressChanged = localTx.progressPercent !== serverTx.progressPercent;
              const stageChanged = localTx.stage !== serverTx.stage;
              const confChanged = localTx.confirmations !== serverTx.confirmations;

              if (statusChanged || progressChanged || stageChanged || confChanged) {
                hasChanges = true;
                return {
                  ...localTx,
                  status: serverTx.status,
                  progressPercent: serverTx.progressPercent,
                  stage: serverTx.stage,
                  stageLabel: serverTx.stageLabel,
                  confirmations: serverTx.confirmations,
                  requiredConfirmations: serverTx.requiredConfirmations,
                  estimatedCompletionTime: serverTx.estimatedCompletionTime,
                  lastPolledAt: serverTx.lastPolledAt
                };
              }
            }
            return localTx;
          });

          if (hasChanges && onUpdateAllTransactions) {
            onUpdateAllTransactions(updatedTransactions);
          }
        }

        if (manual && showToast) {
          showToast(`Mempool & Ledger synchronized • Height #${data.activeSyncState?.networkHeight || 894215}`, 'info');
        }
      }
    } catch {
      // Ignore background poll errors
    } finally {
      setIsPolling(false);
    }
  }, [transactions, onUpdateAllTransactions, showToast]);

  // Set up polling timer: fast interval (3s) when pending txs exist, standard (15s) when all settled
  useEffect(() => {
    const pollInterval = pendingTransactions.length > 0 ? 3000 : 15000;
    const interval = setInterval(() => {
      pollTransactionStatus(false);
    }, pollInterval);

    return () => clearInterval(interval);
  }, [pendingTransactions.length, pollTransactionStatus]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    if (showToast) showToast('Transaction Hash copied to clipboard', 'info');
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleSpeedUp = async (txId: string) => {
    try {
      setSpeedingUpId(txId);
      const res = await fetch('/api/transactions/speed-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: txId })
      });
      if (res.ok) {
        if (showToast) {
          showToast('Priority fee boosted! Transaction accelerated to final confirmation.', 'success');
        }
        await pollTransactionStatus(false);
      }
    } catch {
      if (showToast) showToast('Failed to boost transaction fee.', 'error');
    } finally {
      setSpeedingUpId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Live Polling Status & Network Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center">
              <span className={`w-3 h-3 rounded-full ${pendingTransactions.length > 0 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              <span className={`absolute w-2.5 h-2.5 rounded-full ${pendingTransactions.length > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-black text-white">Live Settlement & Mempool Tracker</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  pendingTransactions.length > 0 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse' 
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {pendingTransactions.length > 0 
                    ? `${pendingTransactions.length} Pending In-Flight` 
                    : 'All Settlements Confirmed'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                <span>Block Height: #{networkSyncState.networkHeight}</span>
                <span>•</span>
                <span>Socket: {pendingTransactions.length > 0 ? 'Real-Time Active (3s)' : 'Idle Sync (15s)'}</span>
                <span>•</span>
                <span>Last Polled: {lastPollTime.toLocaleTimeString()}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => pollTransactionStatus(true)}
              disabled={isPolling}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
              title="Poll latest blockchain and clearinghouse status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
              <span>{isPolling ? 'Syncing...' : 'Poll Network'}</span>
            </button>
          </div>
        </div>

        {/* Real-time In-Flight Cards for Pending Transactions */}
        {pendingTransactions.length > 0 && (
          <div className="mt-4 space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                Live In-Flight Confirmations
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Real-time progress updates directly from consensus nodes
              </span>
            </div>

            {pendingTransactions.map((tx) => {
              const progress = tx.progressPercent || 25;
              const confirmations = tx.confirmations || 0;
              const requiredConf = tx.requiredConfirmations || 3;
              const eta = tx.estimatedCompletionTime || 45;
              const isExpanded = expandedTrackerId === tx.id;

              return (
                <div 
                  key={tx.id} 
                  className="bg-slate-950/90 rounded-xl p-4 border border-amber-500/40 shadow-lg space-y-3 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
                        {tx.type === 'SEND' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-white">
                            {tx.type} {tx.amount.toFixed(tx.assetSymbol === 'BTC' ? 8 : 4)} {tx.assetSymbol}
                          </span>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30">
                            {tx.stageLabel || 'Mempool Broadcasted'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-md font-mono mt-0.5">
                          {tx.details}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                      {onOpenQrModal && (
                        <button
                          onClick={() => onOpenQrModal(tx)}
                          className="px-2.5 py-1 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 hover:text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                          title="Generate shareable verification QR code for secondary device"
                        >
                          <QrCode className="w-3 h-3 text-blue-400" />
                          <span>Verify QR</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleSpeedUp(tx.id)}
                        disabled={speedingUpId === tx.id}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                        title="Accelerate confirmation with priority relay"
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>{speedingUpId === tx.id ? 'Boosting...' : 'Speed Up'}</span>
                      </button>
                      <button
                        onClick={() => setExpandedTrackerId(isExpanded ? null : tx.id)}
                        className="p-1 text-slate-400 hover:text-white rounded transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <Timer className="w-3.5 h-3.5" />
                        Confirmations: {confirmations}/{requiredConf} Blocks
                      </span>
                      <span className="text-slate-300 font-bold">
                        {progress}% Completed {eta > 0 && `(ETA ~${eta}s)`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden relative">
                      <div 
                        className="bg-gradient-to-r from-amber-500 via-emerald-400 to-emerald-500 h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* 4-Stage Lifecycle Stepper */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
                    <div className={`p-1.5 rounded-lg border ${
                      progress >= 20 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}>
                      1. Validation
                    </div>
                    <div className={`p-1.5 rounded-lg border ${
                      progress >= 45 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : progress >= 20 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}>
                      2. Mempool Relay
                    </div>
                    <div className={`p-1.5 rounded-lg border ${
                      progress >= 80 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : progress >= 45 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}>
                      3. Block Confirm
                    </div>
                    <div className={`p-1.5 rounded-lg border ${
                      progress >= 100 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}>
                      4. Final Settlement
                    </div>
                  </div>

                  {/* Expanded On-Chain Audit Details */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-800 space-y-2 text-[11px] text-slate-300 font-mono">
                      <div className="flex items-center justify-between bg-slate-900 p-2 rounded-lg">
                        <span className="text-slate-400">Transaction Hash:</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-amber-300 truncate max-w-[200px] select-all">
                            {tx.hash || 'Generating on-chain payload...'}
                          </span>
                          {tx.hash && (
                            <button
                              onClick={() => handleCopy(tx.hash!, tx.id)}
                              className="p-1 hover:text-white transition-colors"
                              title="Copy Hash"
                            >
                              {copiedHash === tx.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Blockchain Explorer & Recovery Actions */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center space-x-2">
                          {tx.assetSymbol === 'BTC' ? (
                            <>
                              <a
                                href={`https://mempool.space/address/${tx.toAddress || 'bc1q8yyl8yq9np33jfxlhds6tl836rn3trl0762qsd'}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white rounded text-[10px] font-bold flex items-center gap-1 border border-slate-700 transition-colors"
                              >
                                <span>Mempool.space</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <a
                                href={`https://blockstream.info/address/${tx.toAddress || 'bc1q8yyl8yq9np33jfxlhds6tl836rn3trl0762qsd'}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white rounded text-[10px] font-bold flex items-center gap-1 border border-slate-700 transition-colors"
                              >
                                <span>Blockstream</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </>
                          ) : (
                            <a
                              href={`https://etherscan.io/address/${tx.toAddress || '0x'}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white rounded text-[10px] font-bold flex items-center gap-1 border border-slate-700 transition-colors"
                            >
                              <span>Explorer</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {onOpenQrModal && (
                            <button
                              onClick={() => onOpenQrModal(tx)}
                              className="px-2.5 py-1 bg-blue-600/40 hover:bg-blue-600/60 text-blue-200 hover:text-white text-[10px] font-bold rounded flex items-center gap-1 transition-all cursor-pointer shadow-xs border border-blue-500/30"
                              title="Generate shareable verification QR code for secondary device"
                            >
                              <QrCode className="w-3 h-3 text-blue-300" />
                              <span>Share QR</span>
                            </button>
                          )}
                          {onOpenAtmRecovery && (
                            <button
                              onClick={() => onOpenAtmRecovery(tx)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-extrabold rounded flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                              title="Resolve Localcoin or ATM order expiry"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>ATM Order Recovery</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-slate-900 p-2 rounded-lg">
                          <span className="text-slate-400 block mb-0.5">Debit Account (Dr):</span>
                          <span className="text-white font-bold">{tx.ledgerDebit || `${tx.assetSymbol} Holding Account`}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-lg">
                          <span className="text-slate-400 block mb-0.5">Credit Account (Cr):</span>
                          <span className="text-white font-bold">{tx.ledgerCredit || 'External Settlement Node'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter and Search Bar for Activity Ledger */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => onFilterChange('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              selectedFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Activity ({transactions.length})
          </button>

          <button
            onClick={() => onFilterChange('PENDING')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
              selectedFilter === 'PENDING'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>In-Flight ({pendingTransactions.length})</span>
          </button>

          <button
            onClick={() => onFilterChange('COMPLETED')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
              selectedFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Settled ({transactions.filter((t) => t.status === 'completed' || !t.status).length})</span>
          </button>

          <button
            onClick={() => onFilterChange('CRYPTO')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              selectedFilter === 'CRYPTO'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Crypto & On-Chain
          </button>

          <button
            onClick={() => onFilterChange('FIAT')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              selectedFilter === 'FIAT'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Fiat & e-Transfer
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search hash, asset, or recipient..."
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
export default TransactionStatusTracker;
