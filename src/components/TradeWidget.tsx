import React, { useState, useEffect } from 'react';
import { ArrowUpDown, HelpCircle, CheckCircle2, Wallet, RefreshCw, AlertCircle, ShieldCheck, ExternalLink, Copy, Check } from 'lucide-react';
import { Coin, Holding } from '../types';
import { getAssetLegitimacyInfo } from '../lib/assetLegitimacy';

function isReactEventTargetValue(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): string {
  return e.target.value;
}

const DEFAULT_USD_CAD_RATE = 1.36;

interface TradeWidgetProps {
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
  selectedAssetSymbol?: string;
  citizenship?: string;
  onExecuteOtcTrade?: (side: 'BUY' | 'SELL', asset: string, amount: number) => Promise<any>;
}

export default function TradeWidget({
  coins,
  holdings,
  usdBalance,
  onExecuteTrade,
  selectedAssetSymbol = 'BTC',
  citizenship = 'US',
  onExecuteOtcTrade
}: TradeWidgetProps) {
  if (!coins || coins.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center justify-center text-center py-12 min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#0052FF] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-gray-500 font-semibold">Loading live market rates...</p>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'buy' | 'sell' | 'convert'>('buy');
  
  // One-Click Fast Execution State
  const [isOneClickTrade, setIsOneClickTrade] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cb_one_click_trade_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleOneClick = (enabled: boolean) => {
    setIsOneClickTrade(enabled);
    try {
      localStorage.setItem('cb_one_click_trade_enabled', String(enabled));
    } catch (e) {
      // ignore
    }
  };

  // Coin select states
  const [selectedCoinSymbol, setSelectedCoinSymbol] = useState(selectedAssetSymbol);
  const [convertFromSymbol, setConvertFromSymbol] = useState('BTC');
  const [convertToSymbol, setConvertToSymbol] = useState('ETH');
  
  // Input amounts
  const [amountFiat, setAmountFiat] = useState('100');
  const [amountCrypto, setAmountCrypto] = useState('');
  const [isFiatInput, setIsFiatInput] = useState(true);

  // Convert / Swap Tab amounts
  const [convertAmount, setConvertAmount] = useState('0.1');

  // Payment & Offramp Methods
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'bank' | 'card'
  const [sellPayoutMethod, setSellPayoutMethod] = useState('cash'); // 'cash' | 'bank' | 'stripe' | 'wise'

  // Form Submitting and Success screens
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const selectedCoin = coins.find((c) => c.symbol === selectedCoinSymbol) || coins[0];
  const fromCoin = coins.find((c) => c.symbol === convertFromSymbol) || coins[0];
  const toCoin = coins.find((c) => c.symbol === convertToSymbol) || (coins[1] || coins[0]);

  const activeLegitimacy = getAssetLegitimacyInfo(activeTab === 'convert' ? convertFromSymbol : selectedCoinSymbol);

  const currentHolding = holdings.find((h) => h.symbol === selectedCoinSymbol) || { symbol: selectedCoinSymbol, amount: 0 };
  const fromHolding = holdings.find((h) => h.symbol === convertFromSymbol) || { symbol: convertFromSymbol, amount: 0 };

  // Sync state if selected asset symbol changes externally (e.g. from selecting asset in table)
  useEffect(() => {
    if (selectedAssetSymbol) {
      setSelectedCoinSymbol(selectedAssetSymbol);
    }
  }, [selectedAssetSymbol]);

  // Auto-dismiss success notification banner after 5 seconds so trade form stays open and ready
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const isCAD = citizenship === 'CA';
  const currencySymbol = isCAD ? 'CA$' : '$';
  const rate = isCAD ? DEFAULT_USD_CAD_RATE : 1;
  const coinPrice = (selectedCoin?.price || 1) * rate;

  // Derive inputs cleanly without circular useEffect loops
  const numFiat = parseFloat(amountFiat) || 0;
  const numCrypto = parseFloat(amountCrypto) || 0;

  const derivedCryptoVal = isFiatInput ? (coinPrice > 0 ? numFiat / coinPrice : 0) : numCrypto;
  const derivedFiatVal = isFiatInput ? numFiat : numCrypto * coinPrice;

  // Fee computations
  const fiatVal = derivedFiatVal;
  const coinbaseFee = fiatVal === 0 ? 0 : fiatVal < 10 ? 0.99 : fiatVal < 50 ? 1.99 : fiatVal < 200 ? 2.99 : parseFloat((fiatVal * 0.0149).toFixed(2));
  const subtotal = fiatVal;
  const totalCost = activeTab === 'buy' ? subtotal + coinbaseFee : subtotal - coinbaseFee;

  // Swap target calculation
  const convertAmountNum = parseFloat(convertAmount) || 0;
  const fromUnitPriceUSD = fromCoin?.price || 1;
  const toUnitPriceUSD = toCoin?.price || 1;
  const swapUSDValue = convertAmountNum * fromUnitPriceUSD;
  const targetCryptoAmount = toUnitPriceUSD > 0 ? swapUSDValue / toUnitPriceUSD : 0;
  const conversionRate = fromUnitPriceUSD > 0 && toUnitPriceUSD > 0 ? (fromUnitPriceUSD / toUnitPriceUSD).toFixed(6) : '0';

  const handleToggleFiatInput = () => {
    if (isFiatInput) {
      // Switching to Crypto input
      setAmountCrypto(derivedCryptoVal > 0 ? derivedCryptoVal.toFixed(6) : '');
      setIsFiatInput(false);
    } else {
      // Switching to Fiat input
      setAmountFiat(derivedFiatVal > 0 ? derivedFiatVal.toFixed(2) : '');
      setIsFiatInput(true);
    }
  };

  const handleFlipSwapDirection = () => {
    const temp = convertFromSymbol;
    setConvertFromSymbol(convertToSymbol);
    setConvertToSymbol(temp);
  };

  const handlePresetAmount = (percentage: number) => {
    if (activeTab === 'sell') {
      const targetAmt = currentHolding.amount * percentage;
      setAmountCrypto(targetAmt > 0 ? targetAmt.toFixed(6) : '0');
      setIsFiatInput(false);
    } else if (activeTab === 'convert') {
      const targetAmt = fromHolding.amount * percentage;
      setConvertAmount(targetAmt > 0 ? targetAmt.toFixed(6) : '0');
    } else if (activeTab === 'buy') {
      const targetFiat = (usdBalance * rate) * percentage;
      setAmountFiat(targetFiat > 0 ? targetFiat.toFixed(2) : '0');
      setIsFiatInput(true);
    }
  };

  const handlePresetFiat = (val: number) => {
    if (activeTab === 'buy') {
      setAmountFiat(val.toString());
      setIsFiatInput(true);
    }
  };

  const handleAction = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (activeTab === 'buy') {
      const fiat = derivedFiatVal;
      const crypto = derivedCryptoVal;
      if (fiat <= 0 || crypto <= 0) {
        setErrorMessage('Please enter a valid buy amount.');
        return;
      }
      
      // Institutional Guard: Detect Large-Block Trade
      if (fiat >= 100000 && onExecuteOtcTrade) {
        setLoading(true);
        try {
          const res = await onExecuteOtcTrade('BUY', selectedCoin.symbol, crypto);
          setSuccessMessage(`🦅 OTC ORDER FILLED: ${res.message}`);
          return;
        } catch (err: any) {
          setErrorMessage(`OTC Desk rejected order: ${err.message}`);
          return;
        } finally {
          setLoading(false);
        }
      }

      if (paymentMethod === 'cash' && totalCost > usdBalance * rate) {
        setErrorMessage(`Insufficient Cash Balance. You need ${currencySymbol}${totalCost.toFixed(2)} but only have ${currencySymbol}${(usdBalance * rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}.`);
        return;
      }

      setLoading(true);
      try {
        await onExecuteTrade('BUY', {
          symbol: selectedCoin.symbol,
          amount: crypto,
          fiatAmount: fiat / rate
        });
        setSuccessMessage(`⚡ Successfully purchased ${crypto.toFixed(6)} ${selectedCoin.symbol} for ${currencySymbol}${totalCost.toFixed(2)}.`);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to execute buy order.');
      } finally {
        setLoading(false);
      }
    } 
    
    else if (activeTab === 'sell') {
      const cryptoAmount = derivedCryptoVal;
      if (cryptoAmount <= 0) {
        setErrorMessage('Please enter a valid amount to sell.');
        return;
      }

      if (cryptoAmount > currentHolding.amount) {
        setErrorMessage(`Insufficient ${selectedCoin.symbol} balance. You hold ${currentHolding.amount.toFixed(6)} ${selectedCoin.symbol} but tried to sell ${cryptoAmount.toFixed(6)}.`);
        return;
      }

      // Institutional Guard: Detect Large-Block Liquidation
      if (derivedFiatVal >= 100000 && onExecuteOtcTrade) {
        setLoading(true);
        try {
          const res = await onExecuteOtcTrade('SELL', selectedCoin.symbol, cryptoAmount);
          setSuccessMessage(`🦅 OTC LIQUIDATION FILLED: ${res.message}`);
          return;
        } catch (err: any) {
          setErrorMessage(`OTC Desk rejected liquidation: ${err.message}`);
          return;
        } finally {
          setLoading(false);
        }
      }

      setLoading(true);
      try {
        await onExecuteTrade('SELL', {
          symbol: selectedCoin.symbol,
          amount: cryptoAmount,
          fiatAmount: derivedFiatVal / rate
        });

        const payoutDestLabel = 
          sellPayoutMethod === 'bank' ? (isCAD ? 'RBC Checking (*4920) via Interac Direct Offramp' : 'Chase Checking (*4920) via Direct ACH Offramp')
          : sellPayoutMethod === 'stripe' ? 'Visa Card (*8294) via Stripe Instant Push Offramp'
          : sellPayoutMethod === 'wise' ? 'Wise Multi-Currency International Bank Account'
          : `${isCAD ? 'CAD' : 'USD'} Cash Balance`;

        setSuccessMessage(`⚡ Successfully sold ${cryptoAmount.toFixed(6)} ${selectedCoin.symbol} for ${currencySymbol}${totalCost.toFixed(2)}. Payout dispatched to ${payoutDestLabel}.`);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to execute sell order.');
      } finally {
        setLoading(false);
      }
    } 
    
    else if (activeTab === 'convert') {
      const fromAmount = convertAmountNum;
      if (fromAmount <= 0) {
        setErrorMessage('Please enter a valid amount to swap.');
        return;
      }

      if (fromAmount > fromHolding.amount) {
        setErrorMessage(`Insufficient ${fromCoin.symbol} balance. You hold ${fromHolding.amount.toFixed(6)} ${fromCoin.symbol} but tried to swap ${fromAmount.toFixed(6)}.`);
        return;
      }

      if (fromCoin.symbol === toCoin.symbol) {
        setErrorMessage('Cannot swap an asset for itself. Choose two different tokens.');
        return;
      }

      setLoading(true);
      try {
        await onExecuteTrade('CONVERT', {
          symbol: fromCoin.symbol,
          amount: fromAmount,
          fiatAmount: swapUSDValue,
          targetSymbol: toCoin.symbol
        });
        setSuccessMessage(`⚡ Successfully swapped ${fromAmount} ${fromCoin.symbol} for ${targetCryptoAmount.toFixed(6)} ${toCoin.symbol}.`);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to execute swap order.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleUseMax = () => {
    setIsFiatInput(false);
    if (activeTab === 'sell') {
      setAmountCrypto(currentHolding.amount.toString());
    } else if (activeTab === 'convert') {
      setConvertAmount(fromHolding.amount.toString());
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[420px]" id="trade-widget">
      {/* Tabs & 1-Click Toggle Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-gray-100 bg-gray-50/50">
        <div className="flex flex-1">
          {[
            { id: 'buy', label: 'Buy' },
            { id: 'sell', label: 'Sell' },
            { id: 'convert', label: 'Swap / Convert' }
          ].map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => {
                setActiveTab(tabItem.id as 'buy' | 'sell' | 'convert');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-3.5 text-center text-xs sm:text-sm font-bold border-b-2 cursor-pointer transition-all ${
                activeTab === tabItem.id
                  ? 'border-[#0052FF] text-[#0052FF] bg-white shadow-2xs'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50/80'
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* 1-Click Fast Execution Switch */}
        <div className="flex items-center justify-between sm:justify-end px-3 py-2 border-t sm:border-t-0 border-gray-100 bg-white sm:bg-transparent">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className={`text-[11px] font-bold ${isOneClickTrade ? 'text-[#0052FF]' : 'text-gray-500'}`}>
              ⚡ 1-Click Trade
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isOneClickTrade}
              onClick={() => handleToggleOneClick(!isOneClickTrade)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                isOneClickTrade ? 'bg-[#0052FF]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  isOneClickTrade ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Widget Body */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
        {/* 1-Click Fast Execution Status Banner */}
        {isOneClickTrade && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between text-xs text-blue-800 font-medium animate-fade-in">
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              1-Click Fast Trade Active — Instant routing enabled
            </span>
            <span className="text-[10px] bg-white text-blue-600 font-bold px-2 py-0.5 rounded-md border border-blue-200">
              Zero Delay
            </span>
          </div>
        )}

        {/* Inline Confirmed Notification (Non-blocking: Keeps trade form open and ready) */}
        {successMessage && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3.5 flex items-start justify-between gap-2 animate-fade-in shadow-xs">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold block text-emerald-950">Trade Confirmed</span>
                <p className="text-xs text-emerald-800 font-medium">{successMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="space-y-4 flex-1 flex flex-col justify-between">
          {/* Input and Coins Selectors */}
          <div className="space-y-3">
              {/* Asset Selector for Buy/Sell */}
              {activeTab !== 'convert' ? (
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Select Asset
                    </span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {activeLegitimacy.legitimacyBadge}
                    </span>
                  </div>
                  <select
                    value={selectedCoinSymbol}
                    onChange={(e) => setSelectedCoinSymbol(isReactEventTargetValue(e))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs sm:text-sm font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF] cursor-pointer"
                  >
                    {coins.map((coin) => {
                      const leg = getAssetLegitimacyInfo(coin.symbol);
                      return (
                        <option key={coin.symbol} value={coin.symbol}>
                          {coin.name} ({coin.symbol}) — ${coin.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} [{leg.legitimacyBadge}]
                        </option>
                      );
                    })}
                  </select>

                  {/* Live Contract Address Card */}
                  <div className="p-2.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                    <div className="truncate mr-2">
                      <span className="text-slate-400 text-[10px] block font-sans uppercase font-bold">Live Contract Address</span>
                      <span className="text-blue-300 font-bold">{activeLegitimacy.contractAddress}</span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activeLegitimacy.contractAddress);
                          setCopiedAddress(true);
                          setTimeout(() => setCopiedAddress(false), 2000);
                        }}
                        className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                        title="Copy contract address"
                      >
                        {copiedAddress ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedAddress ? 'Copied' : 'Copy'}</span>
                      </button>
                      <a
                        href={activeLegitimacy.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                        title="View on Explorer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* DUAL-PANEL SWAP INTERFACE FOR CONVERT TAB */}
              {activeTab === 'convert' ? (
                <div className="space-y-3">
                  {/* YOU PAY (FROM) PANEL */}
                  <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/60 hover:border-gray-300 transition-all space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wide">
                      <span>You Pay</span>
                      <span className="text-[11px] font-mono text-gray-600">
                        Available: <strong className="text-gray-900">{fromHolding.amount.toFixed(6)} {fromCoin.symbol}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={convertFromSymbol}
                        onChange={(e) => setConvertFromSymbol(isReactEventTargetValue(e))}
                        className="bg-white border border-gray-200 text-gray-900 text-sm font-extrabold px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF] cursor-pointer shrink-0 shadow-2xs"
                      >
                        {coins.map((coin) => (
                          <option key={coin.symbol} value={coin.symbol}>
                            {coin.symbol} (${coin.price > 0 ? coin.price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '1.00'})
                          </option>
                        ))}
                      </select>

                      <div className="flex-1 relative">
                        <input
                          type="number"
                          step="any"
                          placeholder="0.00"
                          value={convertAmount}
                          onChange={(e) => setConvertAmount(isReactEventTargetValue(e))}
                          className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-gray-900 border-none outline-none focus:ring-0 p-0 font-mono text-right"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-400 pt-1 border-t border-gray-100 font-mono">
                      <span>≈ ${swapUSDValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                      <button
                        type="button"
                        onClick={() => setConvertAmount(fromHolding.amount.toString())}
                        className="text-[#0052FF] font-bold hover:underline cursor-pointer text-xs"
                      >
                        MAX ({fromHolding.amount.toFixed(4)})
                      </button>
                    </div>
                  </div>

                  {/* FLIP DIRECTION BUTTON */}
                  <div className="flex justify-center -my-2 relative z-10">
                    <button
                      type="button"
                      onClick={handleFlipSwapDirection}
                      className="p-2.5 bg-white border border-gray-200 hover:border-[#0052FF] hover:bg-blue-50 text-[#0052FF] rounded-full shadow-sm transition-all cursor-pointer flex items-center justify-center group"
                      title="Switch Swap Direction"
                    >
                      <ArrowUpDown className="h-4 w-4 group-hover:rotate-180 transition-transform duration-300" />
                    </button>
                  </div>

                  {/* YOU RECEIVE (TO) PANEL */}
                  <div className="border border-emerald-200/80 rounded-2xl p-4 bg-emerald-50/20 hover:border-emerald-300 transition-all space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wide">
                      <span>You Receive (Estimated)</span>
                      <span className="text-[11px] font-mono text-emerald-700 font-bold">
                        1 {fromCoin.symbol} ≈ {conversionRate} {toCoin.symbol}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={convertToSymbol}
                        onChange={(e) => setConvertToSymbol(isReactEventTargetValue(e))}
                        className="bg-white border border-gray-200 text-gray-900 text-sm font-extrabold px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF] cursor-pointer shrink-0 shadow-2xs"
                      >
                        {coins.map((coin) => (
                          <option key={coin.symbol} value={coin.symbol}>
                            {coin.symbol} (${coin.price > 0 ? coin.price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '1.00'})
                          </option>
                        ))}
                      </select>

                      <div className="flex-1 text-right font-mono text-2xl sm:text-3xl font-extrabold text-emerald-600 truncate">
                        {targetCryptoAmount > 0 ? targetCryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 6 }) : '0.00'}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-400 pt-1 border-t border-gray-100 font-mono">
                      <span>≈ ${swapUSDValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                      <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" /> Zero Slippage
                      </span>
                    </div>
                  </div>

                  {/* CONTRACT ADDRESS BANNER FOR FROM COIN */}
                  <div className="p-2.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                    <div className="truncate mr-2">
                      <span className="text-slate-400 text-[10px] block font-sans uppercase font-bold">{convertFromSymbol} Address ({activeLegitimacy.legitimacyBadge})</span>
                      <span className="text-blue-300 font-bold">{activeLegitimacy.contractAddress}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeLegitimacy.contractAddress);
                        setCopiedAddress(true);
                        setTimeout(() => setCopiedAddress(false), 2000);
                      }}
                      className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[10px] shrink-0"
                    >
                      {copiedAddress ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedAddress ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* BUY / SELL AMOUNT INPUT */
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span className="flex items-center font-medium">
                      <Wallet className="w-3.5 h-3.5 mr-1 text-gray-400" />
                      {activeTab === 'buy'
                        ? `Cash Balance: ${currencySymbol}${(usdBalance * rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : `Available: ${currentHolding.amount.toFixed(6)} ${selectedCoin.symbol}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePresetAmount(1.0)}
                      className="text-[#0052FF] font-bold hover:underline cursor-pointer text-xs"
                    >
                      MAX
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/40 hover:border-gray-300 transition-colors relative">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        {isFiatInput ? (
                          <div className="flex items-center">
                            <span className="text-2xl sm:text-3xl font-extrabold text-gray-400 mr-0.5">{currencySymbol}</span>
                            <input
                              type="number"
                              step="any"
                              placeholder="0"
                              value={amountFiat}
                              onChange={(e) => {
                                setIsFiatInput(true);
                                setAmountFiat(isReactEventTargetValue(e));
                              }}
                              className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-gray-900 border-none outline-none focus:ring-0 p-0 font-mono"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={amountCrypto}
                              onChange={(e) => {
                                setIsFiatInput(false);
                                setAmountCrypto(isReactEventTargetValue(e));
                              }}
                              className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-gray-900 border-none outline-none focus:ring-0 p-0 font-mono"
                            />
                            <span className="text-lg font-bold text-gray-500 ml-1">{selectedCoin.symbol}</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1.5 font-mono font-medium">
                          {isFiatInput
                            ? `≈ ${derivedCryptoVal > 0 ? derivedCryptoVal.toFixed(6) : '0.00'} ${selectedCoin.symbol}`
                            : `≈ ${currencySymbol}${derivedFiatVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleToggleFiatInput}
                        className="p-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:shadow-2xs rounded-full transition-all text-gray-600 hover:text-gray-900 cursor-pointer shrink-0 ml-2"
                        title="Toggle Fiat / Crypto Amount"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* QUICK PRESET BUTTONS FOR QUICK TYPING */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[
                  { label: '25%', pct: 0.25 },
                  { label: '50%', pct: 0.50 },
                  { label: '75%', pct: 0.75 },
                  { label: '100%', pct: 1.00 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetAmount(preset.pct)}
                    className="py-1.5 bg-gray-100 hover:bg-gray-200 active:bg-blue-100 active:text-[#0052FF] text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Payment Select for Buy */}
              {activeTab === 'buy' && (
                <div className="mt-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Payment Method</span>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(isReactEventTargetValue(e))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs sm:text-sm font-semibold px-3 py-2.5 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="cash">
                      {isCAD
                        ? `CAD Cash Balance (${currencySymbol}${(usdBalance * rate).toLocaleString(undefined, { minimumFractionDigits: 2 })})`
                        : `USD Cash Balance (${currencySymbol}${usdBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })})`}
                    </option>
                    <option value="bank">
                      {isCAD ? 'Royal Bank of Canada (RBC) Checking (*4920)' : 'Chase Bank Checking (*4920)'}
                    </option>
                    <option value="card">
                      {isCAD ? 'Canada TD Visa Credit Card (*8294)' : 'Visa Platinum Credit Card (*8294)'}
                    </option>
                  </select>
                </div>
              )}

              {/* Offramp Payout Selector for Sell */}
              {activeTab === 'sell' && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Payout / Offramp Destination</span>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      CONNECTED OFFRAMP
                    </span>
                  </div>
                  <select
                    value={sellPayoutMethod}
                    onChange={(e) => setSellPayoutMethod(isReactEventTargetValue(e))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs sm:text-sm font-semibold px-3 py-2.5 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="cash">
                      {isCAD ? 'CAD Cash Balance (Instant Wallet Deposit)' : 'USD Cash Balance (Instant Wallet Deposit)'}
                    </option>
                    <option value="bank">
                      {isCAD
                        ? 'Interac Direct Deposit — Royal Bank of Canada (*4920)'
                        : 'ACH Direct Deposit — Chase Bank Checking (*4920)'}
                    </option>
                    <option value="stripe">
                      Stripe Direct Card Push Offramp — Visa (*8294)
                    </option>
                    <option value="wise">
                      Wise Multi-Currency Bank Transfer (USD / CAD Wire)
                    </option>
                  </select>
                </div>
              )}
            </div>

            {/* Error Indicators */}
            {errorMessage && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs flex items-start space-x-2 border border-red-100 animate-pulse my-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Price Calculations Review & Final Action Button */}
            <div className="pt-3 border-t border-gray-100 space-y-3 mt-3">
              {activeTab !== 'convert' && (
                <div className="space-y-1 text-xs text-gray-500 font-medium">
                  <div className="flex justify-between">
                    <span>Market price</span>
                    <span className="font-mono">{currencySymbol}{coinPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coinbase Network Fee</span>
                    <span className="font-mono">{currencySymbol}{coinbaseFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-900 font-bold pt-1 border-t border-gray-100">
                    <span>{activeTab === 'buy' ? 'Total Cost' : 'Payout Total'}</span>
                    <span className="font-mono text-[#0052FF]">{currencySymbol}{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleAction}
                disabled={loading}
                className="w-full bg-[#0052FF] hover:bg-blue-700 disabled:bg-gray-300 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer text-center text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center"><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Executing Order...</span>
                ) : activeTab === 'buy' ? (
                  `Buy ${selectedCoin.symbol}`
                ) : activeTab === 'sell' ? (
                  `Sell ${selectedCoin.symbol}`
                ) : (
                  `Swap ${fromCoin.symbol} for ${toCoin.symbol}`
                )}
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}
