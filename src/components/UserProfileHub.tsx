import React, { useState } from 'react';
import { 
  User, Landmark, Mail, ShieldCheck, ExternalLink, Plus, Edit2, Trash2, 
  RefreshCw, TrendingUp, TrendingDown, Wallet, DollarSign, ArrowUpRight, 
  CheckCircle2, Copy, Sliders, PieChart, Shield, Key, Sparkles, Download, 
  Check, AlertCircle, Award, Eye, EyeOff
} from 'lucide-react';
import { Coin, Holding, Transaction } from '../types';

interface UserProfileHubProps {
  coins: Coin[];
  holdings: Holding[];
  usdBalance: number;
  privacyMode: boolean;
  onUpdateHoldings: (newHoldings: Holding[]) => void;
  onUpdateUsdBalance: (newBalance: number) => void;
  onNavigateToTab: (tab: string) => void;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export default function UserProfileHub({
  coins,
  holdings,
  usdBalance,
  privacyMode,
  onUpdateHoldings,
  onUpdateUsdBalance,
  onNavigateToTab,
  showToast
}: UserProfileHubProps) {
  // Add/Edit Asset Modal states
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [selectedCoinSymbol, setSelectedCoinSymbol] = useState(coins[0]?.symbol || 'BTC');
  const [assetAmountInput, setAssetAmountInput] = useState('');
  const [assetBuyPriceInput, setAssetBuyPriceInput] = useState('');
  
  // Custom editing single holding
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editAmountValue, setEditAmountValue] = useState<string>('');

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    showToast(`Copied ${label} to clipboard`, 'info');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Calculations for total portfolio value and PnL
  const holdingsValuation = holdings.map((h) => {
    const coin = coins.find((c) => c.symbol === h.symbol);
    const price = coin ? coin.price : h.avgBuyPrice;
    const value = h.amount * price;
    const costBasis = h.amount * h.avgBuyPrice;
    const pnlUsd = value - costBasis;
    const pnlPercent = costBasis > 0 ? (pnlUsd / costBasis) * 100 : 0;
    return {
      ...h,
      coin,
      currentPrice: price,
      value,
      costBasis,
      pnlUsd,
      pnlPercent
    };
  });

  const totalCryptoValue = holdingsValuation.reduce((sum, h) => sum + h.value, 0);
  const totalCostBasis = holdingsValuation.reduce((sum, h) => sum + h.costBasis, 0);
  const totalNetWorth = totalCryptoValue + usdBalance;
  const overallPnlUsd = totalCryptoValue - totalCostBasis;
  const overallPnlPercent = totalCostBasis > 0 ? (overallPnlUsd / totalCostBasis) * 100 : 0;

  // Filter holdings for display
  const filteredHoldings = holdingsValuation.filter((h) => {
    const symMatch = h.symbol.toLowerCase().includes(assetSearchQuery.toLowerCase());
    const nameMatch = h.coin?.name.toLowerCase().includes(assetSearchQuery.toLowerCase());
    return symMatch || nameMatch;
  });

  // Handle Add / Edit Asset submission
  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(assetAmountInput);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid asset amount greater than 0', 'error');
      return;
    }

    const coin = coins.find((c) => c.symbol === selectedCoinSymbol);
    const buyPrice = parseFloat(assetBuyPriceInput) || coin?.price || 1;

    const existingIndex = holdings.findIndex((h) => h.symbol === selectedCoinSymbol);
    let updated: Holding[];
    if (existingIndex >= 0) {
      updated = [...holdings];
      updated[existingIndex] = {
        symbol: selectedCoinSymbol,
        amount,
        avgBuyPrice: buyPrice
      };
      showToast(`Updated ${selectedCoinSymbol} position to ${amount} tokens`, 'success');
    } else {
      updated = [...holdings, { symbol: selectedCoinSymbol, amount, avgBuyPrice: buyPrice }];
      showToast(`Added ${amount} ${selectedCoinSymbol} to your live assets`, 'success');
    }

    onUpdateHoldings(updated);
    setIsAddAssetOpen(false);
    setAssetAmountInput('');
    setAssetBuyPriceInput('');
  };

  // Quick inline edit save
  const handleInlineSave = (symbol: string) => {
    const parsed = parseFloat(editAmountValue);
    if (isNaN(parsed) || parsed < 0) {
      showToast('Invalid amount', 'error');
      return;
    }

    if (parsed === 0) {
      // Remove holding
      const updated = holdings.filter((h) => h.symbol !== symbol);
      onUpdateHoldings(updated);
      showToast(`Removed ${symbol} from portfolio holdings`, 'info');
    } else {
      const updated = holdings.map((h) => (h.symbol === symbol ? { ...h, amount: parsed } : h));
      onUpdateHoldings(updated);
      showToast(`Updated ${symbol} amount to ${parsed}`, 'success');
    }
    setEditingSymbol(null);
  };

  // Presets for quick syncing of user's actual assets
  const applyPresetPortfolio = (presetType: 'diversified' | 'highConviction' | 'reset') => {
    if (presetType === 'diversified') {
      const newHoldings: Holding[] = [
        { symbol: 'BTC', amount: 0.15, avgBuyPrice: 61500.00 },
        { symbol: 'ETH', amount: 2.50, avgBuyPrice: 3200.00 },
        { symbol: 'SOL', amount: 18.00, avgBuyPrice: 138.50 },
        { symbol: 'AVAX', amount: 35.00, avgBuyPrice: 26.80 },
        { symbol: 'SUI', amount: 450.00, avgBuyPrice: 1.65 },
        { symbol: 'LINK', amount: 65.00, avgBuyPrice: 12.80 },
        { symbol: 'POL', amount: 1200.00, avgBuyPrice: 0.39 },
        { symbol: 'NEAR', amount: 120.00, avgBuyPrice: 4.60 },
        { symbol: 'USDC', amount: 1500.00, avgBuyPrice: 1.00 }
      ];
      onUpdateHoldings(newHoldings);
      onUpdateUsdBalance(6500.00);
      showToast('Synced Full Multi-Chain Diversified Asset Portfolio!', 'success');
    } else if (presetType === 'highConviction') {
      const newHoldings: Holding[] = [
        { symbol: 'BTC', amount: 0.45, avgBuyPrice: 58500.00 },
        { symbol: 'ETH', amount: 4.80, avgBuyPrice: 3050.00 },
        { symbol: 'SOL', amount: 35.00, avgBuyPrice: 132.00 },
        { symbol: 'USDC', amount: 3000.00, avgBuyPrice: 1.00 }
      ];
      onUpdateHoldings(newHoldings);
      onUpdateUsdBalance(8000.00);
      showToast('Synced High-Conviction Core Portfolio!', 'success');
    } else {
      const defaultHoldings: Holding[] = [
        { symbol: 'BTC', amount: 0.082, avgBuyPrice: 59000.00 },
        { symbol: 'ETH', amount: 1.15, avgBuyPrice: 3100.00 },
        { symbol: 'SOL', amount: 12.5, avgBuyPrice: 135.00 },
        { symbol: 'USDC', amount: 500.00, avgBuyPrice: 1.00 }
      ];
      onUpdateHoldings(defaultHoldings);
      onUpdateUsdBalance(4200.00);
      showToast('Reset assets to base portfolio allocation', 'info');
    }
  };

  // Export holdings to JSON / CSV
  const handleExportHoldings = () => {
    const csvContent = [
      ['Symbol', 'Name', 'Amount', 'Current Price ($)', 'Total Value ($)', 'Cost Basis ($)', 'Unrealized PnL ($)', 'PnL (%)'].join(','),
      ...holdingsValuation.map((h) =>
        [
          h.symbol,
          h.coin?.name || h.symbol,
          h.amount,
          h.currentPrice.toFixed(2),
          h.value.toFixed(2),
          h.costBasis.toFixed(2),
          h.pnlUsd.toFixed(2),
          `${h.pnlPercent.toFixed(2)}%`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `whenwerisee_coinbase_assets_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported CSV portfolio ledger report', 'success');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header Profile Identity Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start sm:items-center gap-5">
            {/* Sovereign Vault Crest Avatar */}
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-[#0052FF] flex items-center justify-center text-white shadow-2xl ring-4 ring-blue-500/30">
                <div className="flex flex-col items-center justify-center">
                  <Landmark className="w-8 h-8 text-white" />
                  <span className="text-[10px] font-black tracking-widest uppercase mt-0.5 text-blue-200">SOV</span>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 p-1.5 bg-emerald-500 text-white rounded-full ring-2 ring-slate-900 shadow-md" title="Sovereign Verified Account">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  whenwerisee
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Sovereign Vault VIP
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-2xs font-bold border border-emerald-500/30 uppercase tracking-wider">
                  Tier 3 Institutional
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-mono">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  whenwerisee@gmail.com
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  UID: 253248747
                </span>
                <span className="text-slate-400">
                  Member since Jan 2026
                </span>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => onNavigateToTab('unified')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Open Banking Hub</span>
                </button>

                <button
                  onClick={() => copyToClipboard('253248747', 'Account UID')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  {copiedField === 'Account UID' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'Account UID' ? 'Copied!' : 'Copy UID: 253248747'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Portfolio Stat Chips in Header */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col justify-center min-w-[240px]">
            <div className="flex items-center justify-between text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <span>Actual Total Assets</span>
              <span className="text-blue-400 font-mono">LIVE SYNC</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
              {privacyMode ? '$••••••••••' : `$${totalNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                overallPnlUsd >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {overallPnlUsd >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {overallPnlUsd >= 0 ? '+' : ''}${Math.abs(overallPnlUsd).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({overallPnlPercent.toFixed(2)}%)
              </span>
              <span className="text-2xs text-slate-400">Total All-Time PnL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Allocation & Quick Sync Action Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#0052FF]" />
              <span>Asset Management & Live Holdings</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Add, adjust, or sync your actual crypto assets, cost basis, and balances.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsAddAssetOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#0052FF] text-white text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              id="add-custom-asset-btn"
            >
              <Plus className="w-4 h-4" />
              <span>Add / Edit Asset</span>
            </button>

            <button
              onClick={handleExportHoldings}
              className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200/80 text-gray-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Download CSV asset report"
            >
              <Download className="w-4 h-4 text-gray-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Preset Sync Buttons */}
        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-blue-900">One-Click Portfolio Sync Presets</div>
              <div className="text-2xs text-blue-700">Quickly apply your diversified asset positions or restore standard allocations</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => applyPresetPortfolio('diversified')}
              className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors shadow-2xs cursor-pointer"
            >
              Multi-Chain Diversified (9 Assets)
            </button>
            <button
              onClick={() => applyPresetPortfolio('highConviction')}
              className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors shadow-2xs cursor-pointer"
            >
              High-Conviction (BTC+ETH+SOL)
            </button>
            <button
              onClick={() => applyPresetPortfolio('reset')}
              className="px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Visual Allocation Bar */}
        <div>
          <div className="flex justify-between items-center text-xs font-bold text-gray-700 mb-2">
            <span>Portfolio Allocation</span>
            <span className="text-gray-500 font-mono text-2xs">
              {holdings.length} Active Holdings + USD Cash
            </span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-gray-100">
            {holdingsValuation.map((h, i) => {
              const share = totalNetWorth > 0 ? (h.value / totalNetWorth) * 100 : 0;
              if (share < 1) return null;
              return (
                <div
                  key={h.symbol}
                  style={{
                    width: `${share}%`,
                    backgroundColor: h.coin?.color || '#0052FF'
                  }}
                  className="h-full transition-all hover:opacity-90"
                  title={`${h.symbol}: ${share.toFixed(1)}% ($${h.value.toFixed(2)})`}
                />
              );
            })}
            {usdBalance > 0 && totalNetWorth > 0 && (
              <div
                style={{ width: `${(usdBalance / totalNetWorth) * 100}%` }}
                className="h-full bg-emerald-500 transition-all hover:opacity-90"
                title={`USD Cash: ${((usdBalance / totalNetWorth) * 100).toFixed(1)}% ($${usdBalance.toFixed(2)})`}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2.5 text-2xs font-medium text-gray-600">
            {holdingsValuation.slice(0, 6).map((h) => (
              <div key={h.symbol} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: h.coin?.color || '#0052FF' }} />
                <span>{h.symbol}</span>
                <span className="font-bold text-gray-800">
                  {totalNetWorth > 0 ? `${((h.value / totalNetWorth) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
            ))}
            {usdBalance > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>USD Cash</span>
                <span className="font-bold text-gray-800">
                  {totalNetWorth > 0 ? `${((usdBalance / totalNetWorth) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar for assets */}
        <div className="flex items-center justify-between pt-2">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search your holdings..."
              value={assetSearchQuery}
              onChange={(e) => setAssetSearchQuery(e.target.value)}
              className="w-full text-xs px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#0052FF] transition-all"
            />
          </div>
          <span className="text-xs text-gray-400 font-medium">
            Showing {filteredHoldings.length} of {holdings.length} holdings
          </span>
        </div>

        {/* Assets Table */}
        <div className="overflow-x-auto border border-gray-100 rounded-2xl">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/80 text-2xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4 text-right">Holdings</th>
                <th className="py-3 px-4 text-right">Current Price</th>
                <th className="py-3 px-4 text-right">Market Value</th>
                <th className="py-3 px-4 text-right">Unrealized PnL</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* USD Cash Row */}
              <tr className="hover:bg-gray-50/60 transition-colors bg-blue-50/20">
                <td className="py-3.5 px-4 font-bold text-gray-900 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                    $
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">USD Cash</div>
                    <div className="text-2xs text-gray-400">Fiat Account Balance</div>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                  {privacyMode ? '••••••' : `$${usdBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-gray-600">$1.00</td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                  {privacyMode ? '••••••' : `$${usdBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </td>
                <td className="py-3.5 px-4 text-right text-gray-400 font-mono">-</td>
                <td className="py-3.5 px-4 text-center">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-2xs font-bold">
                    Primary Cash
                  </span>
                </td>
              </tr>

              {/* Crypto Holdings */}
              {filteredHoldings.map((h) => {
                const isEditing = editingSymbol === h.symbol;
                return (
                  <tr key={h.symbol} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-2xs shrink-0 shadow-2xs"
                          style={{ backgroundColor: h.coin?.color || '#0052FF' }}
                        >
                          {h.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 flex items-center gap-1.5">
                            <span>{h.coin?.name || h.symbol}</span>
                            <span className="text-2xs text-gray-400 font-mono font-normal">({h.symbol})</span>
                          </div>
                          <div className="text-2xs text-gray-400 font-mono">
                            Avg cost: ${h.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="any"
                            value={editAmountValue}
                            onChange={(e) => setEditAmountValue(e.target.value)}
                            className="w-24 px-2 py-1 text-xs border border-blue-400 rounded-md focus:outline-none text-right font-mono"
                            autoFocus
                          />
                          <button
                            onClick={() => handleInlineSave(h.symbol)}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                            title="Save"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          {privacyMode ? '••••••' : `${h.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${h.symbol}`}
                        </div>
                      )}
                    </td>

                    {/* Current Price */}
                    <td className="py-3.5 px-4 text-right font-mono text-gray-900">
                      ${h.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {h.coin && (
                        <span className={`block text-2xs font-semibold ${h.coin.change24h >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {h.coin.change24h >= 0 ? '+' : ''}{h.coin.change24h.toFixed(2)}%
                        </span>
                      )}
                    </td>

                    {/* Market Value */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                      {privacyMode ? '••••••' : `$${h.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </td>

                    {/* Unrealized PnL */}
                    <td className="py-3.5 px-4 text-right font-mono">
                      <div className={`font-bold ${h.pnlUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {privacyMode ? '••••••' : `${h.pnlUsd >= 0 ? '+' : ''}$${h.pnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </div>
                      <div className={`text-2xs font-semibold ${h.pnlPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {h.pnlPercent >= 0 ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingSymbol(h.symbol);
                            setEditAmountValue(h.amount.toString());
                          }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Quick Edit Balance"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onNavigateToTab('trade')}
                          className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-2xs font-bold transition-colors cursor-pointer"
                        >
                          Trade
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${h.symbol} from your portfolio holdings?`)) {
                              const updated = holdings.filter((x) => x.symbol !== h.symbol);
                              onUpdateHoldings(updated);
                              showToast(`Removed ${h.symbol} from holdings`, 'info');
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove from Holdings"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredHoldings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                    No holdings match "{assetSearchQuery}". Click "Add / Edit Asset" above to add new coins.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configured Integrations & Connected Systems */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sovereign Vault & Identity Integration Status */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#0052FF]" />
              <span>Sovereign Vault & Interbank Identity</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-2xs font-bold border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Active Link
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Sovereign Vault UID</span>
              <span className="font-bold text-gray-900 font-mono">253248747</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Verified Sovereign Email</span>
              <span className="font-bold text-gray-900 font-mono">whenwerisee@gmail.com</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Banking Hub Status</span>
              <span className="text-emerald-700 font-semibold">Port 10000 Connected & Operational</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Authentication Method</span>
              <span className="text-gray-700 font-mono text-2xs">FIDO2 WebAuthn + SOV_PIN (849201)</span>
            </div>
          </div>
        </div>

        {/* API Keys & Webhook Integrations */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-[#0052FF]" />
              <span>Coinbase Advanced Trade API</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-2xs font-bold border border-blue-200">
              Read / Write
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Production Endpoint</span>
              <span className="font-mono text-2xs text-gray-800">https://api.coinbase.com/v2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">API Key ID</span>
              <span className="font-mono text-2xs text-gray-800">cb_live_whenwerisee_8829a</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Rate Limit Tier</span>
              <span className="text-emerald-700 font-semibold">Tier 3 (100 req/sec)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Mempool RPC Provider</span>
              <span className="text-blue-700 font-semibold">Base Node + Infura ETH</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Add or Edit Holding Asset */}
      {isAddAssetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#0052FF]" />
                <span>Add / Update Holding Asset</span>
              </h3>
              <button
                onClick={() => setIsAddAssetOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Select Cryptocurrency Asset
                </label>
                <select
                  value={selectedCoinSymbol}
                  onChange={(e) => {
                    setSelectedCoinSymbol(e.target.value);
                    const coin = coins.find((c) => c.symbol === e.target.value);
                    if (coin) setAssetBuyPriceInput(coin.price.toString());
                  }}
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#0052FF]"
                >
                  {coins.map((c) => (
                    <option key={c.symbol} value={c.symbol}>
                      {c.name} ({c.symbol}) - ${c.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Holding Amount (Tokens)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 1.25"
                  value={assetAmountInput}
                  onChange={(e) => setAssetAmountInput(e.target.value)}
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#0052FF] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Average Buy Price ($ USD)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 62000.00"
                  value={assetBuyPriceInput}
                  onChange={(e) => setAssetBuyPriceInput(e.target.value)}
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#0052FF] font-mono"
                />
                <span className="text-2xs text-gray-400 mt-1 block">
                  Leave blank to default to current market price.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAssetOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-[#0052FF] hover:bg-blue-700 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  Save Asset Position
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
