import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Copy, 
  Check, 
  Coins, 
  ShieldCheck, 
  Wallet 
} from 'lucide-react';
import { usePortfolioStore } from '../store/portfolio-store';
import { useLivePortfolioSync } from '../hooks/useLivePortfolioSync';

export const LiveMarketPortfolioTable: React.FC = () => {
  const balances = usePortfolioStore((state) => state.balances);
  const totalNetWorthFiat = usePortfolioStore((state) => state.totalNetWorthFiat);
  const isSyncing = usePortfolioStore((state) => state.isSyncing);
  const activeAddresses = usePortfolioStore((state) => state.activeAddresses);

  const { refetchNow } = useLivePortfolioSync(25000);
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);

  const handleCopyAddress = (symbol: string, address?: string) => {
    if (!address) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(address);
      setCopiedSymbol(symbol);
      setTimeout(() => setCopiedSymbol(null), 2000);
    }
  };

  const assetList = Object.values(balances);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header & Global Aggregator Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Real-Time Portfolio & Live Oracle Table</span>
                {isSyncing && (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono px-2 py-0.5 rounded-full border border-indigo-500/30 animate-pulse">
                    Live Syncing...
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">Deterministic multi-chain valuation powered by live spot market feeds</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Aggregated Net Worth</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
              ${totalNetWorthFiat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-sans">USD</span>
            </div>
          </div>

          <button
            onClick={() => refetchNow()}
            disabled={isSyncing}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
            title="Force Price Oracle Sync"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Key Origins / Connected Context Pill Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 text-xs">
        <div className="flex items-center space-x-2 truncate">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-slate-400">Active Vault:</span>
          <span className="font-mono text-slate-200 truncate">
            {activeAddresses.selectedVault ? `${activeAddresses.selectedVault.slice(0, 8)}...${activeAddresses.selectedVault.slice(-6)}` : 'None unlocked'}
          </span>
        </div>
        <div className="flex items-center space-x-2 truncate">
          <Wallet className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-slate-400">Connected Wallet:</span>
          <span className="font-mono text-slate-200 truncate">
            {activeAddresses.connectedWallet ? `${activeAddresses.connectedWallet.slice(0, 8)}...${activeAddresses.connectedWallet.slice(-6)}` : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Real-Time Market Assets Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="pb-3 px-3">Asset / Network</th>
              <th className="pb-3 px-3">Oracle Spot Price</th>
              <th className="pb-3 px-3">24h Change</th>
              <th className="pb-3 px-3 text-right">Holdings</th>
              <th className="pb-3 px-3 text-right">Total Value (USD)</th>
              <th className="pb-3 px-3 text-center">Deposit Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
            {assetList.map((asset) => {
              const isPositive = asset.change24h >= 0;
              return (
                <tr key={asset.symbol} className="hover:bg-slate-800/30 transition">
                  {/* Asset & Network */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white">
                        {asset.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <div className="font-semibold text-white font-sans text-sm">{asset.name}</div>
                        <div className="text-[11px] text-slate-500 font-sans">{asset.network}</div>
                      </div>
                    </div>
                  </td>

                  {/* Oracle Spot Price */}
                  <td className="py-3.5 px-3 text-slate-200">
                    ${asset.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: asset.priceUsd < 10 ? 4 : 2 })}
                  </td>

                  {/* 24h Change */}
                  <td className="py-3.5 px-3">
                    <div className={`flex items-center space-x-1 font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%</span>
                    </div>
                  </td>

                  {/* Holdings Amount */}
                  <td className="py-3.5 px-3 text-right text-slate-200 font-semibold">
                    {asset.balanceFormatted} <span className="text-[10px] text-slate-400 font-normal">{asset.symbol}</span>
                  </td>

                  {/* Total Value */}
                  <td className="py-3.5 px-3 text-right text-emerald-400 font-bold">
                    ${asset.fiatValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Address Actions */}
                  <td className="py-3.5 px-3 text-center">
                    {asset.depositAddress ? (
                      <button
                        onClick={() => handleCopyAddress(asset.symbol, asset.depositAddress)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition inline-flex items-center space-x-1 text-[11px]"
                        title={asset.depositAddress}
                      >
                        {copiedSymbol === asset.symbol ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{asset.depositAddress.slice(0, 6)}...</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-slate-600 text-[11px] font-sans">N/A</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
