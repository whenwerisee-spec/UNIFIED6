import React, { useState, useMemo } from 'react';
import {
  SlidersHorizontal,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Percent,
  Sparkles,
  Zap,
  ArrowRightLeft,
  DollarSign,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Coin, Holding } from '../types';

export interface SmartRebalanceWidgetProps {
  coins: Coin[];
  holdings: Holding[];
  usdBalance: number;
  onExecuteTrade: (
    type: 'BUY' | 'SELL' | 'CONVERT',
    params: {
      symbol: string;
      amount: number;
      fiatAmount: number;
      targetSymbol?: string;
    }
  ) => void;
  className?: string;
}

export interface RebalanceSuggestion {
  symbol: string;
  coinName: string;
  action: 'SELL_TO_CASH' | 'BUY_WITH_CASH' | 'BALANCED';
  currentCryptoAmount: number;
  currentCryptoValueUsd: number;
  currentPercent: number;
  targetPercent: number;
  cryptoDiffAmount: number;
  fiatDiffUsd: number;
  unitPrice: number;
}

export default function SmartRebalanceWidget({
  coins,
  holdings,
  usdBalance,
  onExecuteTrade,
  className = ''
}: SmartRebalanceWidgetProps) {
  // Target Cash Allocation Percentage (e.g. 20% cash, remaining distributed across crypto)
  const [targetCashPercent, setTargetCashPercent] = useState<number>(25);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);
  const [executionSuccess, setExecutionSuccess] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cb_smart_rebalance_expanded');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleExpanded = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    try {
      localStorage.setItem('cb_smart_rebalance_expanded', String(nextState));
    } catch (e) {
      // ignore
    }
  };

  // Calculate Total Portfolio Value & Asset Allocations
  const portfolioAnalysis = useMemo(() => {
    let cryptoTotalUsd = 0;
    const holdingValues: Record<string, { amount: number; valueUsd: number; price: number; name: string }> = {};

    holdings.forEach((h) => {
      const coin = coins.find((c) => c.symbol.toUpperCase() === h.symbol.toUpperCase());
      const price = coin?.price || 0;
      const valUsd = h.amount * price;
      cryptoTotalUsd += valUsd;
      holdingValues[h.symbol.toUpperCase()] = {
        amount: h.amount,
        valueUsd: valUsd,
        price,
        name: coin?.name || h.symbol
      };
    });

    const totalPortfolioUsd = cryptoTotalUsd + Math.max(0, usdBalance);
    const currentCashPercent = totalPortfolioUsd > 0 ? (Math.max(0, usdBalance) / totalPortfolioUsd) * 100 : 0;
    const currentCryptoPercent = totalPortfolioUsd > 0 ? (cryptoTotalUsd / totalPortfolioUsd) * 100 : 0;

    // Target Crypto Total Percent
    const targetCryptoPercent = Math.max(0, 100 - targetCashPercent);

    // Active Crypto Count with Value
    const activeCryptoHoldings = Object.entries(holdingValues).filter(([_, data]) => data.valueUsd > 1);

    const suggestions: RebalanceSuggestion[] = [];

    if (totalPortfolioUsd > 0 && activeCryptoHoldings.length > 0) {
      // Relative weight distribution of existing crypto assets
      const totalActiveCryptoVal = activeCryptoHoldings.reduce((sum, [_, d]) => sum + d.valueUsd, 0);

      activeCryptoHoldings.forEach(([symbol, data]) => {
        const currentPct = (data.valueUsd / totalPortfolioUsd) * 100;
        
        // Target proportion for this asset relative to total target crypto allocation
        const relativeWeight = totalActiveCryptoVal > 0 ? data.valueUsd / totalActiveCryptoVal : 1 / activeCryptoHoldings.length;
        const targetPct = targetCryptoPercent * relativeWeight;
        const targetValueUsd = (targetPct / 100) * totalPortfolioUsd;
        
        const deltaUsd = data.valueUsd - targetValueUsd; // Positive = Overweight (Sell to cash), Negative = Underweight (Buy with cash)
        const unitPrice = data.price > 0 ? data.price : 1;
        const deltaAmount = Math.abs(deltaUsd) / unitPrice;

        let action: 'SELL_TO_CASH' | 'BUY_WITH_CASH' | 'BALANCED' = 'BALANCED';
        if (Math.abs(deltaUsd) >= 1.0) {
          action = deltaUsd > 0 ? 'SELL_TO_CASH' : 'BUY_WITH_CASH';
        }

        suggestions.push({
          symbol,
          coinName: data.name,
          action,
          currentCryptoAmount: data.amount,
          currentCryptoValueUsd: data.valueUsd,
          currentPercent: currentPct,
          targetPercent: targetPct,
          cryptoDiffAmount: deltaAmount,
          fiatDiffUsd: Math.abs(deltaUsd),
          unitPrice
        });
      });
    }

    // Sort by largest adjustment required
    suggestions.sort((a, b) => b.fiatDiffUsd - a.fiatDiffUsd);

    return {
      totalPortfolioUsd,
      currentCashPercent,
      currentCryptoPercent,
      cryptoTotalUsd,
      suggestions
    };
  }, [coins, holdings, usdBalance, targetCashPercent]);

  // One-click Rebalance Execution for a single asset recommendation
  const handleExecuteSingleTrade = async (sug: RebalanceSuggestion) => {
    if (sug.action === 'BALANCED' || sug.fiatDiffUsd < 0.5) return;
    setIsExecuting(sug.symbol);
    setExecutionError(null);
    setExecutionSuccess(null);

    try {
      if (sug.action === 'SELL_TO_CASH') {
        // Sell crypto to cash
        await onExecuteTrade('SELL', {
          symbol: sug.symbol,
          amount: parseFloat(sug.cryptoDiffAmount.toFixed(6)),
          fiatAmount: parseFloat(sug.fiatDiffUsd.toFixed(2))
        });
        setExecutionSuccess(
          `Smart Rebalance executed! Sold ${sug.cryptoDiffAmount.toFixed(4)} ${sug.symbol} for $${sug.fiatDiffUsd.toFixed(2)} USD cash.`
        );
      } else if (sug.action === 'BUY_WITH_CASH') {
        // Buy crypto with cash
        if (usdBalance < sug.fiatDiffUsd) {
          throw new Error(
            `Insufficient cash balance ($${usdBalance.toFixed(2)}) to execute $${sug.fiatDiffUsd.toFixed(2)} purchase.`
          );
        }
        await onExecuteTrade('BUY', {
          symbol: sug.symbol,
          amount: parseFloat(sug.cryptoDiffAmount.toFixed(6)),
          fiatAmount: parseFloat(sug.fiatDiffUsd.toFixed(2))
        });
        setExecutionSuccess(
          `Smart Rebalance executed! Allocated $${sug.fiatDiffUsd.toFixed(2)} USD cash into ${sug.cryptoDiffAmount.toFixed(4)} ${sug.symbol}.`
        );
      }
    } catch (err: any) {
      setExecutionError(err.message || 'Failed to execute rebalance trade.');
    } finally {
      setIsExecuting(null);
    }
  };

  // One-click Execute ALL Rebalance Recommendations in Sequence
  const handleExecuteAllTrades = async () => {
    const actionable = portfolioAnalysis.suggestions.filter((s) => s.action !== 'BALANCED' && s.fiatDiffUsd >= 1.0);
    if (actionable.length === 0) return;

    setIsExecuting('ALL');
    setExecutionError(null);
    setExecutionSuccess(null);

    try {
      // Prioritize sells first to raise cash, then execute buys
      const sells = actionable.filter((s) => s.action === 'SELL_TO_CASH');
      const buys = actionable.filter((s) => s.action === 'BUY_WITH_CASH');

      for (const sell of sells) {
        await onExecuteTrade('SELL', {
          symbol: sell.symbol,
          amount: parseFloat(sell.cryptoDiffAmount.toFixed(6)),
          fiatAmount: parseFloat(sell.fiatDiffUsd.toFixed(2))
        });
      }

      for (const buy of buys) {
        await onExecuteTrade('BUY', {
          symbol: buy.symbol,
          amount: parseFloat(buy.cryptoDiffAmount.toFixed(6)),
          fiatAmount: parseFloat(buy.fiatDiffUsd.toFixed(2))
        });
      }

      setExecutionSuccess(
        `All ${actionable.length} Smart Rebalance trade orders submitted successfully! Target ${targetCashPercent}% Cash reached.`
      );
    } catch (err: any) {
      setExecutionError(err.message || 'Error during portfolio batch rebalance.');
    } finally {
      setIsExecuting(null);
    }
  };

  const cashGapPercent = portfolioAnalysis.currentCashPercent - targetCashPercent;
  const isCashOverweight = cashGapPercent > 1.0;
  const isCashUnderweight = cashGapPercent < -1.0;

  return (
    <div className={`bg-white rounded-3xl border border-gray-100 p-6 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900">Smart Portfolio Rebalance</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
                <Zap className="w-3 h-3" /> One-Click Execution
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Maintain optimal crypto vs. cash reserves with automated trade recommendations
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleExpanded}
          className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition cursor-pointer"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="pt-5 space-y-5">
          {/* Target Cash Allocation Slider & Visual Ratio */}
          <div className="bg-gray-50/80 border border-gray-100 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                  Target Cash Reserve Allocation
                </span>
                <span className="text-[11px] text-gray-500">
                  Slide to adjust your desired target cash percentage
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-[#0052FF] font-mono">
                  {targetCashPercent}%
                </span>
                <span className="text-xs font-semibold text-gray-400">Cash Target</span>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {[10, 20, 25, 33, 50, 75].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setTargetCashPercent(pct)}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition cursor-pointer border ${
                    targetCashPercent === pct
                      ? 'bg-[#0052FF] text-white border-[#0052FF] shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {pct}% Cash
                </button>
              ))}
            </div>

            {/* Range Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={targetCashPercent}
                onChange={(e) => setTargetCashPercent(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0052FF]"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-mono font-semibold">
                <span>0% (100% Crypto)</span>
                <span>50% (Balanced)</span>
                <span>100% (All Cash)</span>
              </div>
            </div>

            {/* Current vs Target Allocation Comparison Bar */}
            <div className="pt-2 border-t border-gray-200/60 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-600">
                  Current Ratio:{' '}
                  <strong className="text-green-600">{portfolioAnalysis.currentCashPercent.toFixed(1)}% Cash</strong> /{' '}
                  <strong className="text-blue-600">{portfolioAnalysis.currentCryptoPercent.toFixed(1)}% Crypto</strong>
                </span>
                <span className="text-gray-600">
                  Target Ratio:{' '}
                  <strong className="text-green-600">{targetCashPercent}% Cash</strong> /{' '}
                  <strong className="text-blue-600">{100 - targetCashPercent}% Crypto</strong>
                </span>
              </div>

              {/* Progress split bar */}
              <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${Math.min(100, portfolioAnalysis.currentCashPercent)}%` }}
                  className="bg-green-500 h-full transition-all duration-300"
                  title={`Current Cash: ${portfolioAnalysis.currentCashPercent.toFixed(1)}%`}
                />
                <div
                  style={{ width: `${Math.min(100, portfolioAnalysis.currentCryptoPercent)}%` }}
                  className="bg-blue-600 h-full transition-all duration-300"
                  title={`Current Crypto: ${portfolioAnalysis.currentCryptoPercent.toFixed(1)}%`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                  <span className="text-gray-600 font-medium">
                    USD Cash (${usdBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                  <span className="text-gray-600 font-medium">
                    Crypto Portfolio (${portfolioAnalysis.cryptoTotalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Messages */}
          {executionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{executionSuccess}</span>
            </div>
          )}

          {executionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{executionError}</span>
            </div>
          )}

          {/* Rebalance Recommendations Table / List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
                <span>Suggested Rebalance Trades ({portfolioAnalysis.suggestions.length})</span>
              </h4>

              {portfolioAnalysis.suggestions.some((s) => s.action !== 'BALANCED' && s.fiatDiffUsd >= 1.0) && (
                <button
                  type="button"
                  onClick={handleExecuteAllTrades}
                  disabled={isExecuting !== null}
                  className="px-3 py-1.5 bg-[#0052FF] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isExecuting === 'ALL' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  <span>Execute All Suggested Trades</span>
                </button>
              )}
            </div>

            {portfolioAnalysis.suggestions.length === 0 ? (
              <div className="p-6 text-center bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-500">
                No active crypto holdings found to rebalance. Deposit or purchase assets to enable automated rebalancing.
              </div>
            ) : (
              <div className="space-y-2.5">
                {portfolioAnalysis.suggestions.map((sug) => {
                  const isSell = sug.action === 'SELL_TO_CASH';
                  const isBuy = sug.action === 'BUY_WITH_CASH';
                  const isBalanced = sug.action === 'BALANCED';

                  return (
                    <div
                      key={sug.symbol}
                      className="p-4 bg-white border border-gray-100 hover:border-gray-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition shadow-xs"
                    >
                      {/* Left: Asset info & current vs target */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isSell
                              ? 'bg-amber-100 text-amber-800'
                              : isBuy
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {sug.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-sm">{sug.coinName}</span>
                            <span className="text-xs font-mono text-gray-400 font-semibold">{sug.symbol}</span>
                            {isSell && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5">
                                <TrendingDown className="w-3 h-3 text-amber-600" /> Overweight
                              </span>
                            )}
                            {isBuy && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-0.5">
                                <TrendingUp className="w-3 h-3 text-blue-600" /> Underweight
                              </span>
                            )}
                            {isBalanced && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Target Met
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Current: <strong>{sug.currentPercent.toFixed(1)}%</strong> (${sug.currentCryptoValueUsd.toFixed(2)}) → Target: <strong>{sug.targetPercent.toFixed(1)}%</strong>
                          </div>
                        </div>
                      </div>

                      {/* Right: Recommendation Action & 1-Click Button */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                        <div className="text-left sm:text-right">
                          {isSell && (
                            <>
                              <div className="text-xs font-bold text-amber-700 font-mono">
                                Sell {sug.cryptoDiffAmount.toFixed(4)} {sug.symbol}
                              </div>
                              <div className="text-[11px] text-gray-500 font-medium">
                                +${sug.fiatDiffUsd.toFixed(2)} to Cash
                              </div>
                            </>
                          )}
                          {isBuy && (
                            <>
                              <div className="text-xs font-bold text-blue-700 font-mono">
                                Buy {sug.cryptoDiffAmount.toFixed(4)} {sug.symbol}
                              </div>
                              <div className="text-[11px] text-gray-500 font-medium">
                                -${sug.fiatDiffUsd.toFixed(2)} from Cash
                              </div>
                            </>
                          )}
                          {isBalanced && (
                            <div className="text-xs font-medium text-emerald-600">
                              Balanced (±0.0%)
                            </div>
                          )}
                        </div>

                        {!isBalanced && (
                          <button
                            type="button"
                            onClick={() => handleExecuteSingleTrade(sug)}
                            disabled={isExecuting !== null}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                              isSell
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {isExecuting === sug.symbol ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            )}
                            <span>{isSell ? 'Sell to Cash' : 'Buy with Cash'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
