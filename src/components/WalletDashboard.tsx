import React from 'react';
import { useLivePortfolioSync } from '../hooks/useLivePortfolioSync';
import { usePortfolioStore } from '../store/portfolio-store';
import { SendMoveAssetsPanel } from './SendMoveAssetsPanel';
import { WormholeL2BridgePanel } from './WormholeL2BridgePanel';
import { LiveMarketPortfolioTable } from './LiveMarketPortfolioTable';

export const WalletDashboard: React.FC = () => {
  // 1. Initialize real-time background balance & spot price oracle loop
  const { refetchNow } = useLivePortfolioSync(25000);

  const totalNetWorth = usePortfolioStore((state) => state.totalNetWorthFiat);
  const activeBridges = usePortfolioStore((state) => state.inFlightBridges);
  const isSyncing = usePortfolioStore((state) => state.isSyncing);

  return (
    <div className="space-y-6 text-white max-w-7xl mx-auto">
      {/* Dynamic Status Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-xl shadow-xl">
        <div>
          <h2 className="text-xl font-bold tracking-tight">On-Chain Portfolio Summary</h2>
          <p className="text-xs text-slate-400 mt-1">Single Source of Truth Store Context Pipeline</p>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-[11px] uppercase font-semibold text-slate-400 block">Combined Aggregated Net Worth</span>
          <span className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400">
            ${totalNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-sans">USD</span>
          </span>
        </div>
      </div>

      {/* Live Market Table */}
      <LiveMarketPortfolioTable />

      {/* Interactive Transfer & Interoperability Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SendMoveAssetsPanel refetchBalancesNow={refetchNow} />
        <WormholeL2BridgePanel refetchBalancesNow={refetchNow} />
      </div>
    </div>
  );
};
