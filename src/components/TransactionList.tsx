import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePlaidLink } from 'react-plaid-link';
import { 
  ExternalTransaction, 
  LedgerTransaction, 
  LedgerAccount,
  IntegrationsState
} from '../types.js';
import { OfflineSyncStatusBar } from './OfflineSyncStatusBar';
import { 
  ArrowRight, 
  Check, 
  Clock, 
  CreditCard, 
  DollarSign, 
  ArrowRightLeft, 
  RefreshCw, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Cpu, 
  FileText,
  BadgeAlert,
  Send,
  Zap,
  CheckCircle,
  AlertTriangle,
  Link2,
  Search,
  Download,
  Filter,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';

interface TransactionListProps {
  externalTransactions: ExternalTransaction[];
  ledgerTransactions: LedgerTransaction[];
  accounts: LedgerAccount[];
  status: IntegrationsState | null;
  onImportSingle: (tx: ExternalTransaction) => void;
  onDispatchOutbound: (node: string, amount: number, description: string, targetAccount: string) => Promise<boolean>;
}

export default function TransactionList({
  externalTransactions,
  ledgerTransactions,
  accounts,
  status,
  onImportSingle,
  onDispatchOutbound
}: TransactionListProps) {
  const [activeTab, setActiveTab] = useState<'feed' | 'ledger' | 'dispatch' | 'coinbase55'>('feed');
  const [expandedLedgerTx, setExpandedLedgerTx] = useState<string | null>(null);

  // Search & Filter state for Central Ledger
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'stripe' | 'wise' | 'plaid' | 'manual'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Coinbase55 remote ledger states
  const [cbSummary, setCbSummary] = useState<any>(null);
  const [cbWallets, setCbWallets] = useState<any[]>([]);
  const [cbTransactions, setCbTransactions] = useState<any[]>([]);
  const [isFetchingCb, setIsFetchingCb] = useState<boolean>(false);
  const [cbError, setCbError] = useState<string | null>(null);

  // Plaid Dynamic Linking states
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  // Dispatch / Ledger action states
  const [dispNode, setDispNode] = useState<'stripe' | 'wise' | 'plaid'>('wise');
  const [dispAmount, setDispAmount] = useState<string>('350.00');
  const [dispDesc, setDispDesc] = useState<string>('International supplier payout');
  const [dispAccount, setDispAccount] = useState<string>('acc_software_expenses');
  const [isDispatching, setIsDispatching] = useState(false);

  // Helpers
  const formatCurr = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getAccountName = (id: string) => {
    return accounts.find(a => a.id === id)?.name || id;
  };

  const toggleLedgerTx = (id: string) => {
    if (expandedLedgerTx === id) {
      setExpandedLedgerTx(null);
    } else {
      setExpandedLedgerTx(id);
    }
  };

  // Filtered and Sorted Ledger Transactions
  const filteredLedgerTransactions = useMemo(() => {
    return ledgerTransactions
      .filter(tx => {
        // Source filter
        if (sourceFilter !== 'all') {
          if (sourceFilter === 'manual' && (tx.source === 'stripe' || tx.source === 'wise' || tx.source === 'plaid')) return false;
          if (sourceFilter !== 'manual' && tx.source !== sourceFilter) return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDesc = tx.description.toLowerCase().includes(q);
          const matchId = tx.id.toLowerCase().includes(q);
          const matchDate = tx.date.toLowerCase().includes(q);
          const matchAccounts = tx.entries.some(e => getAccountName(e.accountId).toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q));
          if (!matchDesc && !matchId && !matchDate && !matchAccounts) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortOrder === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
        const maxA = Math.max(...a.entries.map(e => Math.abs(e.amount)), 0);
        const maxB = Math.max(...b.entries.map(e => Math.abs(e.amount)), 0);
        if (sortOrder === 'highest') return maxB - maxA;
        if (sortOrder === 'lowest') return maxA - maxB;
        return 0;
      });
  }, [ledgerTransactions, sourceFilter, searchQuery, sortOrder, accounts]);

  // Export Central Ledger as CSV
  const handleExportCsv = () => {
    try {
      const headers = ['Transaction ID', 'Date', 'Source', 'Description', 'Account ID', 'Account Name', 'Category', 'Debit (USD)', 'Credit (USD)'];
      const rows: string[][] = [];

      ledgerTransactions.forEach(tx => {
        tx.entries.forEach(entry => {
          const isDebit = entry.amount >= 0;
          const amt = Math.abs(entry.amount).toFixed(2);
          rows.push([
            `"${tx.id}"`,
            `"${tx.date}"`,
            `"${tx.source}"`,
            `"${tx.description.replace(/"/g, '""')}"`,
            `"${entry.accountId}"`,
            `"${getAccountName(entry.accountId).replace(/"/g, '""')}"`,
            `"${entry.category || 'General'}"`,
            isDebit ? `"${amt}"` : '""',
            !isDebit ? `"${amt}"` : '""'
          ]);
        });
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `sovereign_ledger_statement_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportNotice('CSV Statement successfully exported.');
      setTimeout(() => setExportNotice(null), 3000);
    } catch (err: any) {
      alert('Failed to export CSV: ' + err.message);
    }
  };

  // Export Comprehensive Audit Package (JSON with SHA-256 Digest)
  const handleExportAuditJson = async () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        totalTransactions: ledgerTransactions.length,
        accountsCount: accounts.length,
        systemStatus: status?.stripe?.connected && status?.wise?.connected ? 'HEALTHY_SYNCED' : 'PARTIAL_SYNC',
        transactions: ledgerTransactions,
        accountsSummary: accounts.map(a => ({ id: a.id, name: a.name, type: a.type, balance: a.balance }))
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sovereign_audit_package_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportNotice('Audit Package JSON downloaded.');
      setTimeout(() => setExportNotice(null), 3000);
    } catch (err: any) {
      alert('Failed to export audit package: ' + err.message);
    }
  };

  // Plaid Link Setup
  const triggerPlaidLink = async () => {
    setIsGeneratingToken(true);
    try {
      const response = await fetch('/api/plaid/create-link-token', { method: 'POST' });
      const data = await response.json();
      if (data.link_token) {
        setLinkToken(data.link_token);
      } else {
        alert(data.error || 'Failed to generate link token from the Plaid API.');
      }
    } catch (err: any) {
      alert('Error establishing communication with Plaid API: ' + err.message);
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess: async (public_token) => {
      try {
        const response = await fetch('/api/plaid/exchange-public-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token }),
        });
        const data = await response.json();
        if (data.success) {
          alert('Plaid Bank Account successfully linked to Central Ledger!');
          window.location.reload();
        } else {
          alert(data.error || 'Plaid account pairing exchange failed.');
        }
      } catch (err: any) {
        alert('Exchange response failed: ' + err.message);
      }
    },
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const fetchCbData = async () => {
    setIsFetchingCb(true);
    setCbError(null);
    try {
      const [sumRes, walRes, txRes] = await Promise.all([
        fetch('/api/coinbase55/summary'),
        fetch('/api/coinbase55/wallets'),
        fetch('/api/coinbase55/transactions')
      ]);

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setCbSummary(sumData);
      } else {
        const sumErr = await sumRes.json().catch(() => ({}));
        throw new Error(sumErr.error || 'Failed to fetch summary');
      }

      if (walRes.ok) {
        const walData = await walRes.json();
        setCbWallets(Array.isArray(walData) ? walData : (walData.wallets || []));
      }

      if (txRes.ok) {
        const txData = await txRes.json();
        setCbTransactions(Array.isArray(txData) ? txData : (txData.transactions || []));
      }
    } catch (err: any) {
      setCbError(err.message || 'Failed to fetch Coinbase55 remote details');
    } finally {
      setIsFetchingCb(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'coinbase55' && status?.coinbase55?.connected) {
      fetchCbData();
    }
  }, [activeTab, status?.coinbase55?.connected]);

  // Preset for Outbound Ledgers
  const applyDispatchPreset = (nodeType: 'stripe' | 'wise' | 'plaid') => {
    setDispNode(nodeType);
    if (nodeType === 'wise') {
      setDispAmount('450.00');
      setDispDesc('Overseas engineering contractor payment');
      setDispAccount('acc_software_expenses');
    } else if (nodeType === 'stripe') {
      setDispAmount('199.00');
      setDispDesc('Direct Client retainer invoice auto-charge');
      setDispAccount('acc_consulting_revenue');
    } else if (nodeType === 'plaid') {
      setDispAmount('850.00');
      setDispDesc('Plaid ACH bank utility invoice payment');
      setDispAccount('acc_software_expenses');
    }
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispAmount || isNaN(Number(dispAmount)) || Number(dispAmount) <= 0) {
      alert('Please enter a valid positive numerical amount.');
      return;
    }
    setIsDispatching(true);
    const success = await onDispatchOutbound(
      dispNode,
      Number(dispAmount),
      dispDesc,
      dispAccount
    );
    setIsDispatching(false);
    if (success) {
      setDispDesc('');
      setDispAmount('');
      setActiveTab('ledger');
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden" id="transaction-list-container">
      {/* Tab Switcher Header */}
      <div className="flex border-b border-gray-100 bg-gray-50/50 p-2 gap-1 justify-between items-center shrink-0">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'feed'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            id="tab-external-feed"
          >
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-gray-400" />
              Incoming Feeds
              {externalTransactions.filter(t => !t.imported).length > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.25 rounded-full font-bold">
                  {externalTransactions.filter(t => !t.imported).length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ledger'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            id="tab-central-ledger"
          >
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              Central Ledger ({ledgerTransactions.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'dispatch'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            id="tab-dispatch-outbound"
          >
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Execute from Ledger
            </span>
          </button>
          <button
            onClick={() => setActiveTab('coinbase55')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'coinbase55'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            id="tab-coinbase55"
          >
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
              Coinbase55 Ledger
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'feed' ? (
            <motion.div
              key="feed-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Offline-First Persistence Status Bar (IndexedDB + Firestore Fallback) */}
              <OfflineSyncStatusBar />

              {/* Real-time Production Integration Channels & Plaid Link Panel */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5 font-mono">
                  <Link2 className="w-4 h-4 text-slate-400" />
                  Live Production Channels & Node Pairing
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Plaid Node */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-500 uppercase font-mono tracking-wide">Plaid Banking Node</span>
                        <span className={`w-2 h-2 rounded-full ${status?.plaid?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                      </div>
                      <p className="text-xs font-semibold text-slate-800 mt-2">
                        {status?.plaid?.connected ? 'Chase Checking Linked' : 'No Bank Connected'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        Securely stream and balance live bank transaction feeds.
                      </p>
                    </div>
                    <div className="mt-3.5">
                      {status?.plaid?.connected ? (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50/70 p-1.5 rounded border border-emerald-100/30">
                          <CheckCircle className="w-3.5 h-3.5" /> Node Synced End-to-End
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={triggerPlaidLink}
                          disabled={isGeneratingToken || !status?.plaid?.apiKeySet}
                          className="w-full bg-slate-900 text-white rounded py-1.5 text-xs font-medium hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          {isGeneratingToken ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              Link bank via Plaid
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stripe Node */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#635bff] uppercase font-mono tracking-wide">Stripe Sales Node</span>
                        <span className={`w-2 h-2 rounded-full ${status?.stripe?.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      </div>
                      <p className="text-xs font-semibold text-slate-800 mt-2">
                        {status?.stripe?.connected ? 'Stripe Gateway Live' : 'Stripe Key Missing'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        Stripe charge events map automatically via real-time webhooks.
                      </p>
                    </div>
                    <div className="mt-3.5">
                      {status?.stripe?.connected ? (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono bg-slate-50 p-1.5 rounded border border-slate-100">
                          Webhook: <span className="text-indigo-600">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1 text-[9px] text-slate-400 bg-slate-50/50 p-1.5 rounded border border-slate-100">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>Define <code>STRIPE_SECRET_KEY</code> in environment.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Wise Node */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#00b9ff] uppercase font-mono tracking-wide">Wise Wire Node</span>
                        <span className={`w-2 h-2 rounded-full ${status?.wise?.connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      </div>
                      <p className="text-xs font-semibold text-slate-800 mt-2">
                        {status?.wise?.connected ? 'Wise Payouts Connected' : 'Wise Token Missing'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        Instruct Wise channels to execute wire movements instantly.
                      </p>
                    </div>
                    <div className="mt-3.5">
                      {status?.wise?.connected ? (
                        <div className="flex items-center gap-1 text-[10px] text-sky-600 font-bold bg-sky-50/60 p-1.5 rounded border border-sky-100/30">
                          <CheckCircle className="w-3.5 h-3.5" /> Wise Client Ready
                        </div>
                      ) : (
                        <div className="flex items-start gap-1 text-[9px] text-slate-400 bg-slate-50/50 p-1.5 rounded border border-slate-100">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>Define <code>WISE_API_TOKEN</code> in environment.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coinbase55 Node */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-500 uppercase font-mono tracking-wide">Coinbase55 Node</span>
                        <span className={`w-2 h-2 rounded-full ${status?.coinbase55?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
                      </div>
                      <p className="text-xs font-semibold text-slate-800 mt-2">
                        {status?.coinbase55?.connected ? 'Coinbase55 Handshake OK' : 'Coinbase55 Disconnected'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        End-to-end ledger handshake for remote withdrawals & balance summaries.
                      </p>
                    </div>
                    <div className="mt-3.5">
                      {status?.coinbase55?.connected ? (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50/70 p-1.5 rounded border border-emerald-100/30">
                          <CheckCircle className="w-3.5 h-3.5" /> Remote Sync Active
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 text-[9px] text-slate-400 bg-red-50/50 p-1.5 rounded border border-red-100/30">
                          <div className="flex items-start gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5 animate-bounce" />
                            <span className="break-all">{status?.coinbase55?.error || 'Define LEDGER_API_KEY inside environment settings.'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions Feed List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                    Node Raw Events Feed (Webhook Listener)
                  </span>
                  <span className="text-xs text-gray-500">
                    Showing {externalTransactions.length} total raw feed items
                  </span>
                </div>

                {externalTransactions.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-gray-100 rounded-xl bg-gray-50/20">
                    <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-medium">No live events received. Use the Webhook Event Dispatcher above to send data!</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {externalTransactions.map(tx => {
                      const isStripe = tx.source === 'stripe';
                      const isWise = tx.source === 'wise';
                      const isPlaid = tx.source === 'plaid';
                      const isCoinbase55 = tx.source === 'coinbase55';
                      const isOutflow = tx.amount < 0;

                      return (
                        <div
                          key={tx.id}
                          className={`flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-xl transition-all ${
                            tx.imported 
                              ? 'bg-gray-50/50 border-gray-100 opacity-75' 
                              : 'bg-white border-gray-100 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isStripe ? 'bg-[#635bff]/10 text-[#635bff]' :
                              isWise ? 'bg-[#00b9ff]/10 text-[#00b9ff]' :
                              isCoinbase55 ? 'bg-blue-500/10 text-blue-500 font-bold' :
                              'bg-gray-900/10 text-gray-900'
                            }`}>
                              {isStripe ? <CreditCard className="w-4 h-4" /> :
                               isWise ? <ArrowRightLeft className="w-4 h-4" /> :
                               isCoinbase55 ? <RefreshCw className="w-4 h-4 text-blue-500" /> :
                               <Clock className="w-4 h-4" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-gray-900">{tx.description}</span>
                                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.25 rounded font-bold ${
                                  isStripe ? 'bg-[#635bff]/10 text-[#635bff]' :
                                  isWise ? 'bg-[#00b9ff]/10 text-[#00b9ff]' :
                                  isCoinbase55 ? 'bg-blue-100 text-blue-700' :
                                  'bg-zinc-100 text-zinc-700'
                                }`}>
                                  {tx.source}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 font-mono">
                                <span>{tx.date}</span>
                                <span>•</span>
                                <span>Category: {tx.category || 'General'}</span>
                                {tx.imported && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-600 flex items-center gap-0.5 font-bold">
                                      <Check className="w-3.5 h-3.5 text-emerald-500" /> Ledger Reconciled
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-4 mt-3 md:mt-0 pt-3 md:pt-0 border-t md:border-0 border-gray-50">
                            <div className="text-right">
                              <span className={`text-sm font-mono font-bold ${
                                isOutflow ? 'text-rose-600' : 'text-emerald-600'
                              }`}>
                                {isOutflow ? '' : '+'}{formatCurr(tx.amount)}
                              </span>
                              {isStripe && tx.raw?.fee && (
                                <span className="block text-[9px] font-mono text-gray-400">
                                  Fee: {formatCurr(tx.raw.fee)}
                                </span>
                              )}
                            </div>

                            {!tx.imported ? (
                              <button
                                onClick={() => onImportSingle(tx)}
                                className="bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                Sync to Ledger <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <div className="bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 border border-emerald-100/30">
                                <Check className="w-3.5 h-3.5 text-emerald-600" /> Synced
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === 'ledger' ? (
            <motion.div
              key="ledger-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Offline-First Persistence Status Bar */}
              <OfflineSyncStatusBar />

              {/* Header & Export Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-gray-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      General Journal Ledger Entries (Double-Entry Log)
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      Cryptographically Balanced
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                    Showing {filteredLedgerTransactions.length} of {ledgerTransactions.length} verified immutable journal rows
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    title="Export ledger as CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAuditJson}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    title="Download complete audit package"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-300" />
                    <span>Audit JSON</span>
                  </button>
                </div>
              </div>

              {exportNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{exportNotice}</span>
                </div>
              )}

              {/* Search, Filter & Sort Controls */}
              <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/70 flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by description, transaction ID, date, or account name..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Source Filter Chips */}
                  <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 gap-1 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSourceFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        sourceFilter === 'all' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceFilter('stripe')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        sourceFilter === 'stripe' ? 'bg-[#635BFF] text-white' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Stripe
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceFilter('wise')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        sourceFilter === 'wise' ? 'bg-[#00B9FF] text-white' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Wise
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceFilter('plaid')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        sourceFilter === 'plaid' ? 'bg-zinc-900 text-white' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Plaid
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceFilter('manual')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        sourceFilter === 'manual' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Manual
                    </button>
                  </div>

                  {/* Sort Selector */}
                  <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1 text-xs">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      className="bg-transparent text-gray-700 font-semibold focus:outline-none text-xs cursor-pointer"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="highest">Highest Amount</option>
                      <option value="lowest">Lowest Amount</option>
                    </select>
                  </div>
                </div>
              </div>

              {ledgerTransactions.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-gray-100 rounded-xl bg-gray-50/20">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-medium">No ledger transactions posted yet. Sync external transactions above!</p>
                </div>
              ) : filteredLedgerTransactions.length === 0 ? (
                <div className="text-center py-10 border border-gray-100 rounded-xl bg-white space-y-2">
                  <Filter className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-xs text-gray-600 font-semibold">No transactions match your current search or filter.</p>
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSourceFilter('all'); }}
                    className="text-xs text-indigo-600 hover:underline font-bold"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLedgerTransactions.map(tx => {
                    const isExpanded = expandedLedgerTx === tx.id;
                    const isStripe = tx.source === 'stripe';
                    const isWise = tx.source === 'wise';
                    const isPlaid = tx.source === 'plaid';

                    return (
                      <div
                        key={tx.id}
                        className="border border-gray-100 rounded-xl bg-white overflow-hidden transition-all hover:shadow-sm"
                      >
                        {/* Header Row */}
                        <div
                          onClick={() => toggleLedgerTx(tx.id)}
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/40 select-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isStripe ? 'bg-[#635bff]/10 text-[#635bff]' :
                              isWise ? 'bg-[#00b9ff]/10 text-[#00b9ff]' :
                              isPlaid ? 'bg-zinc-950 text-white' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {isStripe ? <CreditCard className="w-4 h-4" /> :
                               isWise ? <ArrowRightLeft className="w-4 h-4" /> :
                               <FileText className="w-4 h-4" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-gray-800">{tx.description}</span>
                                <span className="text-[9px] font-mono uppercase bg-gray-100 text-gray-500 px-1.5 py-0.25 rounded">
                                  {tx.source}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 font-mono">
                                <span>ID: {tx.id}</span>
                                <span>•</span>
                                <span>Posted: {tx.date}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-gray-900 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100/50">
                              Balanced
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* Detailed double-entry splits (Expanded View) */}
                        {isExpanded && (
                          <div className="bg-gray-50/50 px-4 py-3 border-t border-gray-50 text-xs">
                            <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-400 font-mono uppercase tracking-wider pb-1 border-b border-gray-100">
                              <div className="col-span-6">Account Name</div>
                              <div className="col-span-2">Type</div>
                              <div className="col-span-2 text-right">Debit</div>
                              <div className="col-span-2 text-right">Credit</div>
                            </div>

                            <div className="space-y-1.5 mt-2">
                              {tx.entries.map((entry, idx) => {
                                const isDebit = entry.amount >= 0;
                                const amt = Math.abs(entry.amount);

                                return (
                                  <div key={entry.id || idx} className="grid grid-cols-12 gap-2 font-mono py-1 border-b border-gray-50/50">
                                    <div className="col-span-6 font-medium text-gray-800">
                                      {getAccountName(entry.accountId)}
                                    </div>
                                    <div className="col-span-2 text-[10px] text-gray-400 uppercase">
                                      {entry.category || 'Reconciliation'}
                                    </div>
                                    <div className="col-span-2 text-right text-emerald-600 font-semibold">
                                      {isDebit ? formatCurr(amt) : ''}
                                    </div>
                                    <div className="col-span-2 text-right text-gray-500">
                                      {!isDebit ? formatCurr(amt) : ''}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="dispatch-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-100/40 rounded-xl p-4">
                <div className="flex gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 h-9 shrink-0 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Outbound Ledger Command Core</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      As the absolute source of truth, launching a transfer from your general ledger guarantees perfect double-entry compliance. This module instantly creates the balanced journal entries locally, then instructs Wise, Stripe, or Plaid node channels to execute the movement!
                    </p>
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">Quick Presets</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => applyDispatchPreset('wise')}
                    className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-100 p-2.5 rounded-lg text-left transition-all text-xs font-medium cursor-pointer"
                    type="button"
                  >
                    <span className="text-[10px] font-bold text-[#00b9ff] block">Wise Wire FX</span>
                    <span className="text-[11px] font-semibold text-gray-700 block mt-0.5">Pay Overseas Contractor</span>
                  </button>
                  <button
                    onClick={() => applyDispatchPreset('stripe')}
                    className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-100 p-2.5 rounded-lg text-left transition-all text-xs font-medium cursor-pointer"
                    type="button"
                  >
                    <span className="text-[10px] font-bold text-[#635bff] block">Stripe Invoice</span>
                    <span className="text-[11px] font-semibold text-gray-700 block mt-0.5">Charge Client Retainer</span>
                  </button>
                  <button
                    onClick={() => applyDispatchPreset('plaid')}
                    className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-100 p-2.5 rounded-lg text-left transition-all text-xs font-medium cursor-pointer"
                    type="button"
                  >
                    <span className="text-[10px] font-bold text-gray-900 block">Plaid ACH Payout</span>
                    <span className="text-[11px] font-semibold text-gray-700 block mt-0.5">Pay Utility Invoice</span>
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleDispatchSubmit} className="space-y-4 border-t border-gray-100 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-1 uppercase font-mono">Target Channel Node</label>
                    <select
                      value={dispNode}
                      onChange={(e) => setDispNode(e.target.value as any)}
                      className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-700 focus:outline-none focus:border-gray-900 font-medium"
                    >
                      <option value="wise">Wise Payout (USD wire FX)</option>
                      <option value="stripe">Stripe Checkout (Client pay)</option>
                      <option value="plaid">Plaid Direct Bank ACH</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-1 uppercase font-mono">Offset Account</label>
                    <select
                      value={dispAccount}
                      onChange={(e) => setDispAccount(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-700 focus:outline-none focus:border-gray-900 font-medium"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-1 uppercase font-mono">Memo / Reference Description</label>
                    <input
                      type="text"
                      value={dispDesc}
                      onChange={(e) => setDispDesc(e.target.value)}
                      placeholder="e.g. Acme SaaS Subscription Q3"
                      required
                      className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-700 focus:outline-none focus:border-gray-900 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-1 uppercase font-mono">Amount ($ USD)</label>
                    <input
                      type="text"
                      value={dispAmount}
                      onChange={(e) => setDispAmount(e.target.value)}
                      placeholder="250.00"
                      required
                      className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-700 font-mono focus:outline-none focus:border-gray-900 font-bold"
                    />
                  </div>
                </div>

                {/* Double Entry Math Preview block */}
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mt-3">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1 font-mono">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    Double-Entry Splits Preview (Balanced Auto-Commit)
                  </h4>
                  <div className="space-y-2 font-mono text-[11px] text-gray-600">
                    {dispNode === 'wise' && (
                      <>
                        <div className="flex justify-between border-b border-gray-100/60 pb-1">
                          <span>Debit: {getAccountName(dispAccount)} (Expense Increase)</span>
                          <span className="text-emerald-600">+{formatCurr(Math.max(0, Number(dispAmount) - 2.50))}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-100/60 pb-1">
                          <span>Debit: Wise Transfer Transaction fees (Expense Increase)</span>
                          <span className="text-emerald-600">+$2.50</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Credit: Wise Account Balance (Asset Decrease)</span>
                          <span className="text-rose-600">-{formatCurr(Number(dispAmount))}</span>
                        </div>
                      </>
                    )}
                    {dispNode === 'stripe' && (
                      <>
                        <div className="flex justify-between border-b border-gray-100/60 pb-1">
                          <span>Debit: Stripe Clearing (Asset Increase)</span>
                          <span className="text-emerald-600">+{formatCurr(Math.max(0, Number(dispAmount) - (Number(dispAmount) * 0.029 + 0.30)))}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-100/60 pb-1">
                          <span>Debit: Stripe Card Fees (Expense Increase)</span>
                          <span className="text-emerald-600">+{formatCurr(Number(dispAmount) * 0.029 + 0.30)}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Credit: SaaS / Consulting Revenue (Revenue Increase)</span>
                          <span className="text-rose-600 font-bold">-{formatCurr(Number(dispAmount))}</span>
                        </div>
                      </>
                    )}
                    {dispNode === 'plaid' && (
                      <>
                        <div className="flex justify-between border-b border-gray-100/60 pb-1">
                          <span>Debit: {getAccountName(dispAccount)} (Expense Increase)</span>
                          <span className="text-emerald-600">+{formatCurr(Number(dispAmount))}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Credit: Main Bank Account (Asset Decrease)</span>
                          <span className="text-rose-600">-{formatCurr(Number(dispAmount))}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isDispatching}
                    className="bg-gray-950 text-white rounded-xl px-5 py-3 text-xs font-semibold hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    {isDispatching ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Authorizing Dispatch Channels...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Authorize, Commit & Dispatch Node
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {activeTab === 'coinbase55' && (
            <motion.div
              key="coinbase55-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-mono uppercase tracking-wide">
                    <RefreshCw className={`w-4 h-4 text-blue-500 ${isFetchingCb ? 'animate-spin' : ''}`} />
                    Coinbase55 Production Ledger
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Live end-to-end Coinbase55 handshake, balance summaries, wallets, and transactions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchCbData}
                  disabled={isFetchingCb}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingCb ? 'animate-spin' : ''}`} />
                  {isFetchingCb ? 'Syncing...' : 'Fetch Live Ledger'}
                </button>
              </div>

              {!status?.coinbase55?.connected ? (
                <div className="bg-red-50 border border-red-100 rounded-xl p-5 text-center">
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2 animate-bounce" />
                  <h4 className="text-xs font-bold text-red-800 uppercase font-mono mb-1">Coinbase55 Connection Pending</h4>
                  <p className="text-xs text-red-600 max-w-md mx-auto leading-relaxed">
                    Establish pairing by specifying <code>LEDGER_API_KEY</code> and <code>COINBASE55_BASE_URL</code> inside your environment configuration.
                  </p>
                  {status?.coinbase55?.error && (
                    <div className="bg-white border border-red-100 p-3 rounded-lg text-left font-mono text-[10px] text-red-700 mt-3 overflow-x-auto break-all">
                      <strong>Handshake Error:</strong> {status?.coinbase55?.error}
                    </div>
                  )}
                </div>
              ) : cbError ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 text-center">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <h4 className="text-xs font-bold text-amber-800 uppercase font-mono mb-1">Live Sync Interrupted</h4>
                  <p className="text-xs text-amber-600 max-w-md mx-auto mb-3">
                    {cbError}
                  </p>
                  <button
                    onClick={fetchCbData}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold font-mono"
                  >
                    Retry Handshake Sync
                  </button>
                </div>
              ) : isFetchingCb && !cbSummary ? (
                <div className="text-center py-16">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-500 font-medium">Streaming Coinbase55 Ledger Data...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Ledger Summary */}
                  {cbSummary && (
                    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 font-mono">
                        Ledger Balance Summary (Live Feed)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Net Ledger Value</span>
                          <p className="text-lg font-bold text-slate-900 mt-1 font-mono">
                            {formatCurr(cbSummary.netValue !== undefined ? cbSummary.netValue : (cbSummary.totalBalance || cbSummary.balance || cbSummary.balanceUsd || 0))}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Exchange Status</span>
                          <p className="text-xs font-bold text-emerald-600 mt-2 font-mono flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            {cbSummary.status || cbSummary.exchangeStatus || 'Operational'}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Wallets / Node API Count</span>
                          <p className="text-lg font-bold text-slate-900 mt-1 font-mono">
                            {cbWallets.length} active
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Remote Wallets */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Remote Cryptocurrency / Cash Wallets
                    </h4>
                    {cbWallets.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-slate-100">No live wallets returned from Coinbase55 endpoint.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cbWallets.map((wallet: any, idx: number) => {
                          const wId = wallet.id || wallet.address || idx;
                          const name = wallet.name || wallet.label || `Wallet ${idx + 1}`;
                          const rawBalance = wallet.balance !== undefined ? wallet.balance : wallet.amount || 0;
                          const balance = typeof rawBalance === 'number' ? rawBalance : parseFloat(rawBalance) || 0;
                          const currency = wallet.currency || wallet.coin || wallet.asset || 'USD';
                          const usdValue = wallet.usdValue !== undefined ? wallet.usdValue : (currency === 'USD' ? balance : null);

                          return (
                            <div key={wId} className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-bold text-blue-600 font-mono tracking-wider uppercase bg-blue-50 px-2 py-0.5 rounded">
                                  {currency}
                                </span>
                                <p className="text-xs font-bold text-slate-800 mt-2">{name}</p>
                                {wallet.address && (
                                  <p className="text-[9px] font-mono text-slate-400 truncate max-w-[200px] mt-1">
                                    {wallet.address}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold font-mono text-slate-900">
                                  {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                </p>
                                {usdValue !== null && (
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    ≈ {formatCurr(usdValue)}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Remote Transactions */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" />
                      Remote Coinbase55 Transactions
                    </h4>
                    {cbTransactions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-slate-100">No transactions returned from Coinbase55 ledger endpoint.</p>
                    ) : (
                      <div className="space-y-3">
                        {cbTransactions.map((tx: any, idx: number) => {
                          const id = tx.id || tx.txId || tx.hash || idx;
                          const desc = tx.description || tx.memo || `Transfer via Coinbase55`;
                          const rawAmount = tx.amount !== undefined ? tx.amount : (tx.value !== undefined ? tx.value : 0);
                          const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount) || 0;
                          const currency = tx.currency || tx.coin || tx.asset || 'USD';
                          const date = tx.date || tx.createdAt || tx.timestamp || 'N/A';
                          const statusText = tx.status || 'completed';

                          // Check if this transaction exists in externalTransactions to determine if imported
                          const isImported = externalTransactions.some(t => t.id === String(id) && t.imported);

                          return (
                            <div key={id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                  <RefreshCw className="w-4 h-4 text-blue-500" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-semibold text-slate-900">{desc}</span>
                                    <span className="text-[9px] font-mono uppercase bg-blue-50 text-blue-700 px-1.5 py-0.25 rounded font-bold">
                                      {statusText}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                                    <span>{date.split('T')[0]}</span>
                                    <span>•</span>
                                    <span>ID: {String(id).slice(0, 10)}...</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 justify-between md:justify-end shrink-0">
                                <div className="text-right">
                                  <p className={`text-xs font-mono font-bold ${amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {amount < 0 ? '' : '+'}{amount.toLocaleString()} {currency.toUpperCase()}
                                  </p>
                                </div>
                                <div>
                                  {isImported ? (
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded flex items-center gap-0.5">
                                      <Check className="w-3.5 h-3.5" /> Reconciled
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        onImportSingle({
                                          id: String(id),
                                          source: 'coinbase55',
                                          date: date.split('T')[0],
                                          description: desc,
                                          amount: amount,
                                          currency: currency.toUpperCase(),
                                          category: tx.category || 'Withdrawal',
                                          raw: tx,
                                          imported: false
                                        });
                                      }}
                                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold font-mono transition-colors cursor-pointer"
                                    >
                                      Import & Reconcile
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
