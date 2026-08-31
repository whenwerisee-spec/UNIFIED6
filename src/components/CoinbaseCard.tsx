import React, { useState } from 'react';
import { CreditCard, Eye, EyeOff, Lock, Unlock, ShoppingBag, CheckCircle, RefreshCw, Sparkles, Award, ShieldCheck } from 'lucide-react';
import { Coin, Holding } from '../types';
import { getAssetLegitimacyInfo } from '../lib/assetLegitimacy';

interface CoinbaseCardProps {
  holdings: Holding[];
  coins: Coin[];
  onDebitCardSpend: (fiatAmount: number, backingSymbol: string, cashbackSymbol: string, cashbackPercent: number) => boolean;
}

export default function CoinbaseCard({ holdings, coins, onDebitCardSpend }: CoinbaseCardProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Backing funding source
  const [fundingSource, setFundingSource] = useState('USD'); // 'USD' | 'BTC' | 'ETH' | 'SOL'
  
  // Cashback Selection
  const [selectedCashback, setSelectedCashback] = useState({
    symbol: 'BTC',
    percent: 1.0,
    name: 'Bitcoin'
  });

  const cashbacks = [
    { symbol: 'BTC', percent: 1.0, name: 'Bitcoin' },
    { symbol: 'ETH', percent: 1.5, name: 'Ethereum' },
    { symbol: 'SOL', percent: 2.0, name: 'Solana' },
    { symbol: 'USDC', percent: 4.0, name: 'USD Coin' }
  ];

  // Transaction processing state
  const [posLoading, setPosLoading] = useState(false);
  const [posSuccess, setPosSuccess] = useState<string | null>(null);
  const [posError, setPosError] = useState<string | null>(null);

  // Secure Vault Registration state
  const [cardTokenInput, setCardTokenInput] = useState('');
  const [selectedNode, setSelectedNode] = useState('TANGERINE_CHEQUING_9879');
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultSuccess, setVaultSuccess] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);

  const handleRegisterCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError(null);
    setVaultSuccess(null);
    if (!cardTokenInput.trim()) {
      setVaultError('Card token identifier is required.');
      return;
    }
    setVaultLoading(true);
    try {
      const token = sessionStorage.getItem('cb_auth_jwt_token') || localStorage.getItem('cb_auth_jwt_token');
      const res = await fetch('/api/card/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ cardToken: cardTokenInput, nodeID: selectedNode })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Registration failed');
      }
      setVaultSuccess(`Successfully bound and cryptographically locked token signature to Node ${selectedNode}.`);
      setCardTokenInput('');
    } catch (err: any) {
      setVaultError(err.message);
    } finally {
      setVaultLoading(false);
    }
  };

  const purchaseOptions = [
    { name: 'Production Purchase', price: 12.50 },
    { name: 'Organic Grocery Basket', price: 54.20 },
    { name: 'Mechanical Keyboard Upgrade', price: 129.99 },
    { name: 'Subscription Cloud Computing', price: 24.50 }
  ];

  // Handle card spending
  const handleCardSwipe = (itemName: string, itemPrice: number) => {
    setPosError(null);
    setPosSuccess(null);

    if (isLocked) {
      setPosError('Transaction declined: Your Coinbase Debit Card is currently locked.');
      return;
    }

    if (!itemName || !Number.isFinite(itemPrice)) {
      setPosError('This merchant entry could not be processed.');
      return;
    }

    setPosLoading(true);
    setTimeout(() => {
      const success = onDebitCardSpend(itemPrice, fundingSource, selectedCashback.symbol, selectedCashback.percent);
      setPosLoading(false);

      if (success) {
        const rewardEarned = (itemPrice * (selectedCashback.percent / 100));
        setPosSuccess(
          `Swiped ${itemName} for $${itemPrice.toFixed(2)} using ${fundingSource}. You earned ${rewardEarned.toFixed(6)} ${selectedCashback.symbol} in cashback rewards.`
        );
      } else {
        const fundingBalance = getFundingBalance();
        setPosError(`Insufficient funds in ${fundingBalance} to complete this transaction at ${itemName}.`);
      }
    }, 1200);
  };

  const getFundingBalance = () => {
    if (fundingSource === 'USD') {
      return 'USD Cash';
    }
    const holding = holdings.find((h) => h.symbol === fundingSource);
    return holding ? `${holding.amount.toFixed(6)} ${fundingSource}` : `0.00 ${fundingSource}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="coinbase-card-hub">
      {/* Visual Visa Card and Card Controls - Span 5 Cols */}
      <div className="lg:col-span-5 space-y-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Your Coinbase Card</h3>
        
        {/* Visa Card Design */}
        <div className="relative h-56 w-full max-w-sm mx-auto rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 shadow-xl overflow-hidden flex flex-col justify-between border border-white/10">
          {/* Glowing Ambient Background Circles */}
          <div className="absolute top-[-40%] right-[-10%] w-64 h-64 bg-[#0052FF] rounded-full blur-3xl opacity-20 pointer-events-none" />
          <div className="absolute bottom-[-50%] left-[-20%] w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-15 pointer-events-none" />

          {/* Locked Overlay */}
          {isLocked && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center space-y-2 z-10">
              <Lock className="h-10 w-10 text-[#0052FF]" />
              <span className="text-sm font-bold tracking-wider text-slate-300 uppercase">Card Blocked</span>
            </div>
          )}

          {/* Row 1: Brand & Contactless symbol */}
          <div className="flex justify-between items-center relative z-2">
            <div className="flex items-center space-x-1">
              <svg className="w-5 h-5 text-[#0052FF]" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
              </svg>
              <span className="text-sm font-bold tracking-tight">coinbase</span>
            </div>
            
            {/* Contactless wave icon */}
            <svg className="w-6 h-6 text-slate-400 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10" />
              <path d="M8.5 5a12.1 12.1 0 0 1 3 7 12.1 12.1 0 0 1-3 7" />
              <path d="M5 8a8.5 8.5 0 0 1 2 4 8.5 8.5 0 0 1-2 4" />
            </svg>
          </div>

          {/* Row 2: Chip & Eye Toggle */}
          <div className="flex justify-between items-end relative z-2">
            <div className="w-10 h-8 rounded-md bg-gradient-to-r from-amber-200 to-amber-400 border border-amber-300/30 shadow-xs flex items-center justify-center">
              {/* Chip lines */}
              <div className="grid grid-cols-3 gap-0.5 w-6 h-4 opacity-50">
                <div className="border border-slate-900/30 rounded-xs" />
                <div className="border border-slate-900/30 rounded-xs" />
                <div className="border border-slate-900/30 rounded-xs" />
                <div className="border border-slate-900/30 rounded-xs" />
                <div className="border border-slate-900/30 rounded-xs" />
                <div className="border border-slate-900/30 rounded-xs" />
              </div>
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-300"
            >
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Row 3: Details */}
          <div className="relative z-2">
            <p className="text-xs text-slate-400 tracking-wider">DEBIT</p>
            <div className="flex justify-between items-end mt-1">
              <div>
                <p className="text-base font-semibold tracking-widest font-mono">
                  {showDetails ? '4532 8920 1198 4290' : '•••• •••• •••• 4290'}
                </p>
                <div className="flex space-x-4 mt-1">
                  <div>
                    <span className="text-[8px] text-slate-400 block font-sans">EXPIRY</span>
                    <span className="text-xs font-semibold font-mono">08/29</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 block font-sans">CVV</span>
                    <span className="text-xs font-semibold font-mono">{showDetails ? '502' : '•••'}</span>
                  </div>
                </div>
              </div>
              
              {/* Visa Logo */}
              <span className="text-lg italic font-extrabold text-blue-400 tracking-wide">VISA</span>
            </div>
          </div>
        </div>

        {/* Card quick locks & details controls */}
        <div className="flex items-center justify-around bg-gray-50 p-2 rounded-xl border border-gray-100 max-w-sm mx-auto">
          <button
            onClick={() => setIsLocked(!isLocked)}
            className="flex-1 py-2 flex flex-col items-center justify-center text-xs text-gray-600 hover:text-gray-900 cursor-pointer"
          >
            {isLocked ? (
              <>
                <Unlock className="h-4 w-4 text-green-600 mb-1" />
                <span>Unlock Card</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-gray-500 mb-1" />
                <span>Lock Card</span>
              </>
            )}
          </button>
          <div className="w-px h-8 bg-gray-200" />
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex-1 py-2 flex flex-col items-center justify-center text-xs text-gray-600 hover:text-gray-900 cursor-pointer"
          >
            <Eye className="h-4 w-4 text-gray-500 mb-1" />
            <span>{showDetails ? 'Hide Details' : 'Show Details'}</span>
          </button>
        </div>

        {/* Secure Node Binding Vault Panel */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl max-w-sm mx-auto mt-6">
          <div className="flex items-center space-x-2 mb-3">
            <Lock className="h-4 w-4 text-[#0052FF]" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Secure Node Binding Vault</h4>
          </div>
          <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
            Encrypt your card identifier and tie it immutably to one of your connected Tangerine account ledger nodes.
          </p>
          <form onSubmit={handleRegisterCard} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Card Token / Identifier</label>
              <input
                type="text"
                value={cardTokenInput}
                onChange={(e) => setCardTokenInput(e.target.value)}
                placeholder="e.g. 4532 8920 1198 4290"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0052FF] font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Account Node</label>
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#0052FF]"
              >
                <option value="TANGERINE_CHEQUING_9879">Tangerine Chequing (*9879)</option>
                <option value="TANGERINE_SAVINGS_0336">Tangerine Savings (*0336)</option>
                <option value="TANGERINE_JOINT_9886">Tangerine Joint (*9886)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={vaultLoading}
              className="w-full py-2 bg-[#0052FF] hover:bg-blue-600 disabled:bg-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              {vaultLoading ? 'Establishing Link...' : 'Link Card Node'}
            </button>
          </form>
          {vaultError && <p className="mt-3 text-[10px] text-red-400 font-semibold">{vaultError}</p>}
          {vaultSuccess && <p className="mt-3 text-[10px] text-green-400 font-semibold">{vaultSuccess}</p>}
        </div>
      </div>

      {/* Card Settings, Cashback, and Merchant Point-of-Sale - Span 7 Cols */}
      <div className="lg:col-span-7 space-y-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Debit Card Controls & Spending</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Funding configuration card */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-xs">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
              <CreditCard className="w-3.5 h-3.5 text-gray-500 mr-1.5" /> Funding Asset
            </h4>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Select which asset on your Coinbase exchange balances automatically backs Visa spends.
            </p>
            <select
              value={fundingSource}
              onChange={(e) => setFundingSource(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs font-semibold px-2.5 py-2 rounded-lg cursor-pointer focus:outline-none"
            >
              <option value="USD">USD Cash Balance (FDIC Insured Cash)</option>
              {['BTC', 'ETH', 'SOL', 'USDC', 'USDT'].map((sym) => {
                const leg = getAssetLegitimacyInfo(sym);
                return (
                  <option key={sym} value={sym}>
                    {sym} — {leg.formattedAddress} [{leg.legitimacyBadge}]
                  </option>
                );
              })}
            </select>
            {fundingSource !== 'USD' && (
              <div className="mt-2 p-2 bg-slate-900 text-slate-100 rounded-lg flex items-center justify-between text-[10px] font-mono">
                <span className="text-blue-300 font-bold truncate">Address: {getAssetLegitimacyInfo(fundingSource).contractAddress}</span>
                <span className="text-emerald-400 font-bold shrink-0 ml-1">{getAssetLegitimacyInfo(fundingSource).legitimacyBadge}</span>
              </div>
            )}
            <span className="text-[11px] text-gray-400 font-mono mt-1.5 block">
              Backed Balance: {getFundingBalance()}
            </span>
          </div>

          {/* Cashback configurator */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-xs">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
              <Sparkles className="w-3.5 h-3.5 text-yellow-500 mr-1.5 animate-pulse" /> Spend Reward
            </h4>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Choose which digital asset rewards you automatically claim as Cashback on card spends.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {cashbacks.map((cb) => (
                <button
                  key={cb.symbol}
                  onClick={() => setSelectedCashback(cb)}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    selectedCashback.symbol === cb.symbol
                      ? 'border-[#0052FF] bg-[#0052FF]/5 text-gray-900'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-[10px] font-bold block">{cb.symbol}</span>
                  <span className="text-[11px] text-gray-500 font-semibold">{cb.percent}% Back</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Merchant Point-of-Sale checkout terminal */}
        <div className="bg-gray-50/50 border border-gray-200 rounded-2xl p-6 relative">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
            <ShoppingBag className="w-4 h-4 text-gray-600 mr-1.5" /> Point-of-Sale Checkout
          </h4>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Select a merchant entry below to process a card payment using your configured funding source and cashback preferences.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {purchaseOptions.map((opt) => (
              <button
                key={opt.name}
                disabled={posLoading}
                onClick={() => handleCardSwipe(opt.name, opt.price)}
                className="p-3 bg-white hover:bg-gray-50 border border-gray-100 rounded-xl text-left cursor-pointer transition-all flex justify-between items-center hover:shadow-xs group"
              >
                <div>
                  <span className="text-xs font-semibold text-gray-900 block group-hover:text-[#0052FF] transition-colors">
                    {opt.name}
                  </span>
                  <span className="text-[10px] text-gray-400">Card payment option</span>
                </div>
                <span className="text-xs font-bold text-gray-900 font-mono">${opt.price.toFixed(2)}</span>
              </button>
            ))}
          </div>

          {/* Payment response notifications */}
          {posLoading && (
            <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-xl flex items-center justify-center space-x-2 font-semibold">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Transacting card swipe wirelessly with Visa Network...</span>
            </div>
          )}

          {posError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-start space-x-2 border border-red-100">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{posError}</span>
            </div>
          )}

          {posSuccess && (
            <div className="p-4 bg-green-50 text-green-800 text-xs sm:text-sm rounded-xl flex items-start space-x-3 border border-green-100 animate-fade-in">
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold">Transaction Confirmed</h5>
                <p className="mt-1 text-xs text-gray-600 leading-relaxed">{posSuccess}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
