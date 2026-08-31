import React, { useState, useMemo } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, CheckCircle2, Copy, RefreshCw, Smartphone, QrCode, Mail, Wallet, Plus, ShieldCheck, ExternalLink, Check, Fuel, Zap, Globe, Gauge, Camera } from 'lucide-react';
import { Coin, Holding } from '../types';
import { getAssetLegitimacyInfo } from '../lib/assetLegitimacy';
import { recognizeNetwork, calculateAutomatedGas, resolveTokenInfo, UNIVERSAL_TOKEN_REGISTRY, GasCalculationResult } from '../lib/token-network-gas';
import CameraQrScannerModal from './CameraQrScannerModal';

interface SendReceiveModalProps {
  coins: Coin[];
  holdings: Holding[];
  isOpen: boolean;
  onClose: () => void;
  initialAction?: 'send' | 'receive';
  initialSendAmount?: string;
  initialRecipient?: string;
  initialRecipientAddress?: string;
  initialSymbol?: string;
  initialMemo?: string;
  initialAmountBtc?: number;
  onExecuteTransaction: (
    type: 'SEND' | 'RECEIVE',
    symbol: string,
    amount: number,
    fiatAmount: number,
    details: string,
    recipientAddress?: string
  ) => boolean | Promise<boolean>;
}

export default function SendReceiveModal({
  coins,
  holdings,
  isOpen,
  onClose,
  initialAction = 'send',
  initialSendAmount,
  initialRecipient,
  initialRecipientAddress,
  initialSymbol,
  initialMemo,
  initialAmountBtc,
  onExecuteTransaction
}: SendReceiveModalProps) {
  const [action, setAction] = useState<'send' | 'receive'>(initialAction);
  
  // Send States
  const [sendSymbol, setSendSymbol] = useState(initialSymbol || 'BTC');
  const [sendAmount, setSendAmount] = useState(initialSendAmount || '');
  const [recipient, setRecipient] = useState(initialRecipient || '');
  const [isFiat, setIsFiat] = useState(false);
  const [gasTier, setGasTier] = useState<'economy' | 'standard' | 'fast' | 'instant'>('standard');
  const [transactionMemo, setTransactionMemo] = useState(initialMemo || '');

  // Update states if props change when opening modal
  React.useEffect(() => {
    if (!isOpen) return;

    if (initialAction) setAction(initialAction);
    if (initialSymbol) setSendSymbol(initialSymbol);
    if (initialSendAmount) setSendAmount(initialSendAmount);
    const nextRecipient = initialRecipient || initialRecipientAddress || '';
    setRecipient(nextRecipient);
    if (initialMemo) setTransactionMemo(initialMemo);
    if (typeof initialAmountBtc === 'number' && initialAmountBtc > 0) {
      setIsFiat(false);
      setSendAmount(initialAmountBtc.toString());
    }
  }, [isOpen, initialAction, initialSymbol, initialSendAmount, initialRecipient, initialRecipientAddress, initialMemo, initialAmountBtc]);

  // Receive States
  const [receiveSymbol, setReceiveSymbol] = useState(initialSymbol || 'BTC');

  // Transaction Status
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  const handleCameraScanSuccess = (data: { address: string; amount?: number; currency?: string; memo?: string }) => {
    if (data.address) {
      setRecipient(data.address);
    }
    if (data.currency && coins.some(c => c.symbol === data.currency)) {
      setSendSymbol(data.currency);
    }
    if (data.amount && data.amount > 0) {
      setIsFiat(false);
      setSendAmount(data.amount.toString());
    }
    if (data.memo) {
      setTransactionMemo(data.memo);
    }
  };

  // Derive coins map
  const coinPriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    coins.forEach(c => { map[c.symbol] = c.price; });
    return map;
  }, [coins]);

  // Derive user gas balances
  const userGasBalances = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach(h => { map[h.symbol] = h.amount; });
    return map;
  }, [holdings]);

  // Combined list of tokens
  const allAvailableTokens = useMemo(() => {
    const set = new Set<string>();
    coins.forEach(c => set.add(c.symbol));
    Object.keys(UNIVERSAL_TOKEN_REGISTRY).forEach(sym => set.add(sym));
    return Array.from(set);
  }, [coins]);

  if (!isOpen) return null;

  const currentCoin = coins.find((c) => c.symbol === (action === 'send' ? sendSymbol : receiveSymbol)) || {
    symbol: action === 'send' ? sendSymbol : receiveSymbol,
    name: action === 'send' ? sendSymbol : receiveSymbol,
    price: coinPriceMap[action === 'send' ? sendSymbol : receiveSymbol] || 1,
    change24h: 0,
    volume24h: 0,
    marketCap: 0,
    high24h: 0,
    low24h: 0
  };

  const currentHolding = holdings.find((h) => h.symbol === sendSymbol) || { symbol: sendSymbol, amount: 0 };

  // Calculate fiat to crypto conversion
  const sendAmountNum = parseFloat(sendAmount) || 0;
  const currentCoinPrice = currentCoin.price || 1;
  const convertedCryptoAmount = isFiat ? sendAmountNum / currentCoinPrice : sendAmountNum;
  const convertedFiatAmount = isFiat ? sendAmountNum : sendAmountNum * currentCoinPrice;

  // Auto-recognize recipient network
  const recipientNetwork = recognizeNetwork(recipient);
  const sendTokenInfo = resolveTokenInfo(sendSymbol);
  const receiveTokenInfo = resolveTokenInfo(receiveSymbol);

  // Auto-calculated Gas
  const gasEstimate: GasCalculationResult = calculateAutomatedGas(
    sendSymbol,
    userGasBalances,
    coinPriceMap,
    gasTier
  );

  // Render a wallet address based on the selected receive coin
  const getWalletAddress = (symbol: string) => {
    const token = resolveTokenInfo(symbol);

    // Check Address Hub / LocalStorage first for user-owned addresses
    try {
      const savedAddrs = localStorage.getItem('cb_addresses');
      if (savedAddrs) {
        const parsed = JSON.parse(savedAddrs);
        const match = parsed.find((a: any) => a.coinSymbol === symbol || (symbol === 'BTC' && a.coinSymbol === 'BTC'));
        if (match && match.address) return match.address;
      }
    } catch (e) {}

    // Fallback to Environment Variables
    if (symbol === 'BTC') {
      return (import.meta as any).env?.VITE_MARSHALL_BTC_ADDRESS || 'bc1qz8w9j7k6m5n4p3r2t1v0x9y8z7w6v5u';
    }

    if (token.network.includes('Ethereum') || token.network.includes('EVM') || symbol === 'ETH' || symbol === 'USDC' || symbol === 'USDF') {
      return (import.meta as any).env?.VITE_MARSHALL_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    }

    if (token.network.includes('Solana')) return '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    if (token.network.includes('XRP')) return 'rEb8TK3gYQCfyAam7C16m6W8ZfS23nVTwk';

    return (import.meta as any).env?.VITE_MARSHALL_ADDRESS || '';
  };

  const handleSendSubmit = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (sendAmountNum <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    if (!recipient) {
      setErrorMsg('Please specify a recipient email or address.');
      return;
    }

    if (convertedCryptoAmount > currentHolding.amount) {
      setErrorMsg(`Insufficient ${sendSymbol} holdings. You own ${currentHolding.amount.toFixed(6)} ${sendSymbol} but tried to send ${convertedCryptoAmount.toFixed(6)}.`);
      return;
    }

    setLoading(true);
    const detailsMsg = `Sent ${convertedCryptoAmount.toFixed(6)} ${sendSymbol} to ${recipient.substring(0, 16)}... via ${sendTokenInfo.network} (Gas Fee: ${gasEstimate.gasFeeCrypto.toFixed(6)} ${gasEstimate.gasToken})`;

    onExecuteTransaction(
      'SEND',
      sendSymbol,
      convertedCryptoAmount,
      convertedFiatAmount,
      detailsMsg,
      recipient
    ).then((executed) => {
      setLoading(false);
      if (!executed) {
        setErrorMsg(`The ${sendSymbol} transfer was not broadcast. Check custody configuration and try again.`);
        return;
      }
      setSuccessMsg(`Successfully broadcast on ${sendTokenInfo.network}! Sent ${convertedCryptoAmount.toFixed(6)} ${sendSymbol} ($${convertedFiatAmount.toFixed(2)}) to ${recipient}.`);
      setSendAmount('100');
    }).catch((err) => {
      setLoading(false);
      setErrorMsg(`Transaction failed: ${err.message || 'Unknown error'}`);
    });
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(getWalletAddress(receiveSymbol));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Record an incoming deposit for the selected asset
  const handleRecordDeposit = (depositAmount: number) => {
    setLoading(true);
    setTimeout(() => {
      const valueUSD = depositAmount * (currentCoin.price || 1);
      const detailsMsg = `Received external blockchain deposit of ${depositAmount} ${receiveSymbol} on ${receiveTokenInfo.network}`;
      onExecuteTransaction(
        'RECEIVE',
        receiveSymbol,
        depositAmount,
        valueUSD,
        detailsMsg
      );
      setLoading(false);
      setSuccessMsg(`Successfully confirmed deposit of ${depositAmount} ${receiveSymbol} ($${valueUSD.toFixed(2)}) on ${receiveTokenInfo.network}!`);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" id="send-receive-modal">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all w-full max-w-lg animate-slide-up border border-gray-100">
          
          {/* Header */}
          <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => {
                  setAction('send');
                  setSuccessMsg(null);
                  setErrorMsg(null);
                }}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  action === 'send' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Send Crypto
              </button>
              <button
                onClick={() => {
                  setAction('receive');
                  setSuccessMsg(null);
                  setErrorMsg(null);
                }}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  action === 'receive' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Receive Crypto
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          {successMsg ? (
            <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
              <CheckCircle2 className="h-14 w-14 text-emerald-500" />
              <div>
                <h4 className="text-base font-bold text-gray-900">Immutable Ledger Confirmed</h4>
                <p className="text-xs text-gray-500 mt-2 max-w-sm">{successMsg}</p>
              </div>
              <button
                onClick={() => setSuccessMsg(null)}
                className="px-6 py-2 bg-[#0052FF] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-lg cursor-pointer transition-colors"
              >
                Execute Another Transaction
              </button>
            </div>
          ) : action === 'send' ? (
            /* SEND CRYPTO PANEL */
            <div className="space-y-4">
              {/* Configured Active Localcoin ATM Order Presets */}
              <div className="p-3.5 bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 text-white rounded-2xl border border-amber-500/40 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                      Active ATM Order: RGVTQ6
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                    $995 CAD e-Transfer
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 font-mono flex items-center justify-between">
                  <span>Target: <strong className="text-white">0.01039642 BTC</strong></span>
                  <span className="text-emerald-400 font-bold">Payment Requested</span>
                </div>
                <div className="text-[10px] font-mono text-emerald-300 truncate bg-slate-950/80 p-1.5 rounded-lg border border-slate-800 select-all">
                  bc1q8yyl8yq9np33jfxlhds6tl836rn3trl0762qsd
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSendSymbol('BTC');
                      setIsFiat(false);
                      setSendAmount('0.01039642');
                      setRecipient('bc1q8yyl8yq9np33jfxlhds6tl836rn3trl0762qsd');
                    }}
                    className="py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] rounded-lg transition-all cursor-pointer text-center"
                  >
                    1-Click Load RGVTQ6 ($995)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSendSymbol('BTC');
                      setIsFiat(false);
                      setSendAmount('0.00108546');
                      setRecipient('bc1q6v3yhrhkulnxlrq4m2ksr75lzr8z70rlft0e5u');
                    }}
                    className="py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] rounded-lg border border-slate-700 transition-all cursor-pointer text-center"
                  >
                    Load RXBYQQ ($100)
                  </button>
                </div>
              </div>

              {/* Asset selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 uppercase block">Select Token to Send</label>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200/60 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    {sendTokenInfo.legitimacyBadge}
                  </span>
                </div>
                <select
                  value={sendSymbol}
                  onChange={(e) => setSendSymbol(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl focus:outline-none cursor-pointer"
                >
                  {allAvailableTokens.map((sym) => {
                    const held = holdings.find((h) => h.symbol === sym) || { amount: 0 };
                    const token = resolveTokenInfo(sym);
                    return (
                      <option key={sym} value={sym}>
                        {token.name} ({sym}) — {held.amount.toFixed(4)} held • {token.network}
                      </option>
                    );
                  })}
                </select>
                
                {/* Linked Contract Address Display */}
                <div className="p-2.5 bg-slate-900 text-slate-100 rounded-xl flex items-center justify-between text-[11px] font-mono shadow-inner">
                  <div className="truncate mr-2">
                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Linked Contract / L1 Address</span>
                    <span className="text-blue-300 font-semibold">{sendTokenInfo.contractAddress}</span>
                  </div>
                  <a
                    href={sendTokenInfo.explorerTokenUrl || sendTokenInfo.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-2 py-1 rounded flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Recipient info & Auto Network Recognition */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase block">Recipient Address or Identifier</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Enter 0x address, Bitcoin bc1, Solana address, or email"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs font-mono pl-10 pr-10 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCameraScannerOpen(true)}
                    className="absolute right-2 top-2 p-1.5 bg-gray-200 hover:bg-[#0052FF] hover:text-white text-gray-600 rounded-lg cursor-pointer transition-colors"
                    title="Scan QR Code with Camera"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Auto Network Recognition Badge */}
                <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between text-xs text-blue-900">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <div>
                      <span className="font-bold text-[11px] block">{recipientNetwork.networkName}</span>
                      <span className="text-[10px] text-blue-600 block">{recipientNetwork.matchedPattern}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-200/70 text-blue-800 px-1.5 py-0.5 rounded">
                    Auto-Recognized
                  </span>
                </div>
              </div>

              {/* Amount input */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Send Amount</label>
                    <div className="flex items-center">
                      {isFiat && <span className="text-xl font-bold text-gray-500 mr-0.5">$</span>}
                      <input
                        type="number"
                        placeholder="0.00"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        className="w-full bg-transparent text-2xl font-extrabold text-gray-900 border-none outline-none focus:ring-0 p-0 font-mono"
                      />
                    </div>
                    <span className="text-xs text-gray-400 mt-1 block">
                      {isFiat
                        ? `≈ ${convertedCryptoAmount.toFixed(6)} ${sendSymbol}`
                        : `≈ $${convertedFiatAmount.toFixed(2)} USD`}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsFiat(!isFiat)}
                    className="p-2 bg-white border border-gray-100 rounded-full text-gray-500 hover:text-gray-900 cursor-pointer shadow-xs"
                    title="Toggle Fiat / Crypto input"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Automated Gas & Network Fee Engine */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Fuel className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold text-gray-800">Automated Network Gas Fee</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-900">
                    {gasEstimate.gasFeeCrypto.toFixed(6)} {gasEstimate.gasToken} (~${gasEstimate.gasFeeUsd.toFixed(2)})
                  </span>
                </div>

                {/* Gas Speed Tiers */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {(['economy', 'standard', 'fast', 'instant'] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setGasTier(tier)}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                        gasTier === tier
                          ? 'bg-[#0052FF] text-white shadow-xs'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-200">
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <Zap className="w-3 h-3 text-emerald-500" />
                    <span>100% Sponsored by Sovereign Vault (0 Fee)</span>
                  </span>
                  <span>Est. Time: ~{gasEstimate.estimatedTimeSeconds}s</span>
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-100">
                  {errorMsg}
                </p>
              )}

              <button
                onClick={handleSendSubmit}
                disabled={loading}
                className="w-full py-3 bg-[#0052FF] hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors text-center text-sm cursor-pointer shadow-sm"
              >
                {loading ? 'Validating & Broadcasting On-Chain...' : `Execute & Record ${sendSymbol} Transfer`}
              </button>
            </div>
          ) : (
            /* RECEIVE CRYPTO PANEL */
            <div className="space-y-4 flex flex-col items-center text-center">
              <div className="w-full space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 uppercase block">Select Asset to Receive</label>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200/60 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    {receiveTokenInfo.legitimacyBadge}
                  </span>
                </div>
                <select
                  value={receiveSymbol}
                  onChange={(e) => setReceiveSymbol(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl focus:outline-none cursor-pointer"
                >
                  {allAvailableTokens.map((sym) => {
                    const token = resolveTokenInfo(sym);
                    return (
                      <option key={sym} value={sym}>
                        {token.name} ({sym}) • {token.network}
                      </option>
                    );
                  })}
                </select>
                
                {/* Linked Contract Address */}
                <div className="p-2.5 bg-slate-900 text-slate-100 rounded-xl flex items-center justify-between text-[11px] font-mono text-left shadow-inner">
                  <div className="truncate mr-2">
                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Contract / Protocol Identifier</span>
                    <span className="text-blue-300 font-semibold">{receiveTokenInfo.contractAddress}</span>
                  </div>
                  <a
                    href={receiveTokenInfo.explorerTokenUrl || receiveTokenInfo.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-2 py-1 rounded flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* QR Code display */}
              <div className="bg-white p-4 border border-gray-100 rounded-2xl shadow-sm">
                <div className="w-40 h-40 bg-gray-50 flex items-center justify-center rounded-xl border border-dashed border-gray-200 relative">
                  <QrCode className="h-28 w-28 text-gray-900" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#0052FF] border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                    C
                  </div>
                </div>
              </div>

              {/* Secure Address Copy section */}
              <div className="w-full">
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1 text-left">Your {receiveSymbol} Deposit Address ({receiveTokenInfo.network})</span>
                <div className="flex bg-gray-50 p-2 rounded-xl border border-gray-200 items-center justify-between">
                  <p className="text-[11px] text-gray-700 font-mono font-semibold truncate flex-1 px-2 text-left">
                    {getWalletAddress(receiveSymbol)}
                  </p>
                  <button
                    onClick={handleCopyAddress}
                    className="p-1.5 bg-white hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900 transition-all border border-gray-200 cursor-pointer shadow-2xs"
                    title="Copy wallet address"
                  >
                    {copied ? <span className="text-[10px] text-emerald-600 font-bold px-1">Copied!</span> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="w-full pt-4 border-t border-gray-100 mt-2 text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-2">Live Deposit Status</span>
                <p className="text-[11px] text-gray-500 leading-relaxed px-4">
                  Incoming transfers are detected automatically on-chain. Send {receiveSymbol} to the address above and your balance will update after 3 block confirmations.
                </p>
                <div className="mt-3">
                  <a
                    href={receiveTokenInfo.explorerUrl || `https://etherscan.io/address/${getWalletAddress(receiveSymbol)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-700 hover:bg-gray-100 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#0052FF]" />
                    <span>Track Inbound via Explorer</span>
                  </a>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Live Camera WebRTC Scanner Modal */}
      <CameraQrScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScanSuccess={handleCameraScanSuccess}
        title="Scan Recipient or ATM QR Code"
        instruction="Hold your camera up to any Bitcoin, EVM, or Solana QR code to automatically fill recipient and transfer details."
      />
    </div>
  );
}
