import React from 'react';
import { Coin } from '../types';

export interface AssetRowData {
  id: string;
  isCash: boolean;
  symbol: string;
  name: string;
  sublabel: string;
  color: string;
  amountFormatted: string;
  amountNum: number;
  fiatValue: number;
  allocation: number;
  priceFormatted: string;
  coinObj?: Coin;
}

export interface AssetRowProps {
  row: AssetRowData;
  liveCashBalance: number;
  onOpenCashModal: (action: 'deposit' | 'withdraw') => void;
  onSelectCoin: (coin: Coin) => void;
  onQuickBacking: (symbol: string) => void;
  onBuy?: (symbol: string) => void;
  onSell?: (symbol: string) => void;
  onSwap?: (symbol: string) => void;
  onCashout?: (symbol: string) => void;
}

export const AssetRow: React.FC<AssetRowProps> = React.memo(({
  row,
  liveCashBalance,
  onOpenCashModal,
  onSelectCoin,
  onQuickBacking,
  onBuy,
  onSell,
  onSwap,
  onCashout
}) => {
  if (row.isCash) {
    return (
      <tr className="hover:bg-gray-50/50 transition-colors" id="asset-row-usd">
        <td className="px-6 py-4 font-semibold text-gray-900 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-black text-xs">
            $
          </div>
          <div>
            <div className="text-sm font-bold">USD Cash</div>
            <div className="text-xs text-gray-400 font-medium">Fiat Cash Balance</div>
          </div>
        </td>
        <td className="px-6 py-4 text-right">
          <div className="text-sm font-bold text-gray-900 font-mono">
            ${liveCashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </td>
        <td className="px-6 py-4 text-right">
          <span className="text-xs text-gray-500 font-mono font-semibold">
            {row.allocation.toFixed(1)}%
          </span>
        </td>
        <td className="px-6 py-4 text-right font-mono text-gray-500 text-xs">
          $1.00
        </td>
        <td className="px-6 py-4 text-center">
          <div className="flex justify-center items-center space-x-2">
            <button
              id="asset-cash-deposit-btn"
              onClick={() => onOpenCashModal('deposit')}
              className="text-xs font-bold text-[#0052FF] hover:underline cursor-pointer"
            >
              Deposit
            </button>
            <span className="text-gray-300">|</span>
            <button
              id="asset-cash-withdraw-btn"
              onClick={() => onOpenCashModal('withdraw')}
              className="text-xs font-bold text-[#0052FF] hover:underline cursor-pointer"
            >
              Withdraw
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      id={`asset-row-${row.symbol.toLowerCase()}`}
      className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
      onClick={() => {
        if (row.coinObj) {
          onSelectCoin(row.coinObj);
        }
      }}
    >
      <td className="px-6 py-4 font-semibold text-gray-900 flex items-center space-x-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs font-mono"
          style={{ backgroundColor: row.color }}
        >
          {row.symbol.slice(0, 2)}
        </div>
        <div>
          <div className="text-sm font-bold">{row.name}</div>
          <div className={`text-xs text-gray-400 font-medium font-mono ${row.symbol === 'BTC' ? 'max-w-[260px] break-all' : ''}`}>
            {row.sublabel}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="text-sm font-bold text-gray-900 font-mono">
          {row.amountFormatted}
        </div>
        <div className="text-xs text-gray-400 font-medium font-mono">
          ${row.fiatValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="text-xs text-gray-500 font-mono font-semibold">
          {row.allocation.toFixed(1)}%
        </span>
      </td>
      <td className="px-6 py-4 text-right font-mono text-gray-900 text-xs sm:text-sm">
        {row.priceFormatted}
      </td>
      <td className="px-6 py-4 text-center">
        <div className="flex flex-wrap justify-center gap-1.5">
          {onBuy && (
            <button
              onClick={(e) => { e.stopPropagation(); onBuy(row.symbol); }}
              className="text-[10px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 transition cursor-pointer"
            >
              BUY
            </button>
          )}
          {onSell && (
            <button
              onClick={(e) => { e.stopPropagation(); onSell(row.symbol); }}
              className="text-[10px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg border border-rose-200 transition cursor-pointer"
            >
              SELL
            </button>
          )}
          {onSwap && (
            <button
              onClick={(e) => { e.stopPropagation(); onSwap(row.symbol); }}
              className="text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition cursor-pointer"
            >
              SWAP
            </button>
          )}
          {onCashout && (
            <button
              onClick={(e) => { e.stopPropagation(); onCashout(row.symbol); }}
              className="text-[10px] font-black text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 transition cursor-pointer"
            >
              CASHOUT
            </button>
          )}
          <button
            id={`quick-backing-${row.symbol.toLowerCase()}`}
            onClick={(e) => {
              e.stopPropagation();
              onQuickBacking(row.symbol);
            }}
            className="text-[10px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 transition cursor-pointer"
          >
            DETAILS
          </button>
        </div>
      </td>
    </tr>
  );
});

export default AssetRow;
