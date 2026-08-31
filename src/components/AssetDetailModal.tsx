import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, Bell, BellOff, Info, Coins, ShieldAlert, Award, Star } from 'lucide-react';
import { Coin, TimeFrame } from '../types';
import CoinChart from './CoinChart';

interface AssetDetailModalProps {
  coin: Coin | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectForTrade: (symbol: string) => void;
  isWatchlisted: boolean;
  onToggleWatchlist: (symbol: string) => void;
}

export default function AssetDetailModal({
  coin,
  isOpen,
  onClose,
  onSelectForTrade,
  isWatchlisted,
  onToggleWatchlist,
}: AssetDetailModalProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeFrame>('1D');
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  if (!coin || !isOpen) return null;

  const isPositive = coin.change24h >= 0;

  // Fetch appropriate historical array based on selected timeframe
  const getHistoryData = () => {
    switch (selectedTimeframe) {
      case '1H': return coin.sparkline;
      case '1D': return coin.history1D;
      case '1W': return coin.history1W;
      case '1M': return coin.history1M;
      case '1Y': return coin.history1Y;
      case 'ALL': return coin.history1Y; // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" id="asset-detail-modal">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-end justify-center p-4 sm:items-center sm:p-0">
        {/* Content Container */}
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all w-full max-w-4xl p-6 sm:my-8 animate-slide-up">
          
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-gray-100 mb-6">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: coin.color }}
              >
                {coin.symbol.slice(0, 2)}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-gray-900">{coin.name}</h2>
                  <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded-sm font-semibold">
                    {coin.symbol}
                  </span>
                  <button
                    onClick={() => onToggleWatchlist(coin.symbol)}
                    className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-yellow-500 transition-colors cursor-pointer"
                    title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                  >
                    <Star className={`h-4.5 w-4.5 ${isWatchlisted ? 'fill-yellow-400 text-yellow-500' : ''}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-500">Popularity Rank #{coin.popularity}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center space-x-1 text-xs font-semibold ${
                  alertsEnabled
                    ? 'bg-blue-50 border-blue-200 text-[#0052FF]'
                    : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900'
                }`}
                title="Create custom alert"
              >
                {alertsEnabled ? <Bell className="h-4 w-4 text-[#0052FF]" /> : <BellOff className="h-4 w-4" />}
                <span className="hidden sm:inline">{alertsEnabled ? 'Alert On' : 'Alert Me'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart Area - Span 2 Columns */}
            <div className="lg:col-span-2 space-y-6">
              <CoinChart
                data={getHistoryData()}
                title={coin.name}
                change24h={coin.change24h}
                symbol={coin.symbol}
                selectedTimeframe={selectedTimeframe}
                setSelectedTimeframe={setSelectedTimeframe}
                basePrice={coin.price}
              />

              {/* About Section */}
              <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                  <Info className="h-4.5 w-4.5 text-gray-500" />
                  <span>About {coin.name}</span>
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-2.5 leading-relaxed">
                  {coin.description}
                </p>
              </div>
            </div>

            {/* Sidebar Stats and Trade CTA */}
            <div className="space-y-6">
              {/* Quick statistics bento card */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Market Statistics</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
                    <span className="text-xs sm:text-sm text-gray-500">Market Cap</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 font-mono">
                      ${coin.marketCap >= 1e12 ? `${(coin.marketCap / 1e12).toFixed(2)}T` : `${(coin.marketCap / 1e9).toFixed(2)}B`}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
                    <span className="text-xs sm:text-sm text-gray-500">24h Volume</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 font-mono">
                      ${(coin.volume24h / 1e9).toFixed(2)}B
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
                    <span className="text-xs sm:text-sm text-gray-500">Circulating Supply</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 font-mono">
                      {coin.circulatingSupply}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
                    <span className="text-xs sm:text-sm text-gray-500">All-Time High</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 font-mono">
                      ${coin.allTimeHigh.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-xs sm:text-sm text-gray-500">Popularity Rank</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 font-mono">
                      #{coin.popularity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Guard Card */}
              <div className="bg-[#0052FF]/5 border border-[#0052FF]/10 rounded-xl p-4 flex items-start space-x-3">
                <Coins className="h-5 w-5 text-[#0052FF] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-gray-900">Supported by Coinbase Protection</h4>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    Cold wallet insurance policies guard this asset symbol. Transact with multi-chain compatibility.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  onSelectForTrade(coin.symbol);
                  onClose();
                }}
                className="w-full py-4 px-4 bg-[#0052FF] hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-center text-sm cursor-pointer"
              >
                Trade {coin.name} Now
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
