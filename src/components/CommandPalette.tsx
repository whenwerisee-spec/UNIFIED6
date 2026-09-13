import React, { useState, useEffect, useCallback } from 'react';
import { Search, Send, Repeat, ArrowDownLeft, ShieldCheck, Zap, Coins, X, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Coin, Holding } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  coins: Coin[];
  holdings: Holding[];
  onAction: (type: 'send' | 'swap' | 'buy' | 'cashout', symbol: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  coins,
  holdings,
  onAction
}) => {
  const [query, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredItems = useMemo(() => {
    // Merge default coins and holdings that aren't in default list
    const searchList = [...coins];
    holdings?.forEach(h => {
      if (!searchList.some(c => c.symbol === h.symbol)) {
        searchList.push({
          symbol: h.symbol,
          name: h.symbol,
          price: 1.0,
          color: '#0052FF'
        } as any);
      }
    });

    return searchList.filter(c =>
      c.symbol.toLowerCase().includes(query.toLowerCase()) ||
      c.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
  }, [query, coins, holdings]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
    if (e.key === 'ArrowUp') setSelectedIndex(prev => Math.max(prev - 1, 0));
    if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      onAction('send', filteredItems[selectedIndex].symbol);
      onClose();
    }
  }, [filteredItems, selectedIndex, onAction, onClose]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setSelectedIndex(0);
      setSearchQuery('');
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative z-10"
      >
        <div className="p-4 flex items-center gap-3 border-b border-slate-800">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            autoFocus
            type="text"
            placeholder="Search assets or type commands (e.g. 'Send BTC')..."
            value={query}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-white text-base placeholder:text-slate-500"
          />
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px] text-slate-400 font-mono">
            <kbd>ESC</kbd>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredItems.length > 0 ? (
            <div className="space-y-1">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Assets & Tokens
              </div>
              {filteredItems.map((coin, idx) => (
                <button
                  key={coin.symbol}
                  onClick={() => {
                    onAction('send', coin.symbol);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                    idx === selectedIndex ? 'bg-indigo-600/20 border border-indigo-500/30' : 'border border-transparent hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: coin.color }}
                    >
                      {coin.symbol.slice(0, 2)}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">{coin.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{coin.symbol} • {holdings.find(h => h.symbol === coin.symbol)?.amount.toFixed(4) || '0.00'} held</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">${coin.price.toLocaleString()}</span>
                    {idx === selectedIndex && (
                      <div className="flex items-center gap-1 text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded font-bold">
                        <span>SEND</span>
                        <kbd>↵</kbd>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-3">
              <X className="w-8 h-8 opacity-20" />
              <p className="text-sm">No matching assets found for "{query}"</p>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">↵</kbd> Action
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
            <ShieldCheck className="w-3 h-3" />
            <span>Sovereign Search Active</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
