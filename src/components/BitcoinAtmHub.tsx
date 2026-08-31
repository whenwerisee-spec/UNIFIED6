import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  QrCode,
  ArrowDownLeft,
  ArrowUpRight,
  MapPin,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Search,
  ShieldCheck,
  Zap,
  Smartphone,
  Printer,
  DollarSign,
  Banknote,
  AlertCircle,
  ExternalLink,
  Navigation,
  Clock,
  Key,
  Shield,
  Layers,
  ChevronRight,
  Camera,
  Timer,
  LifeBuoy
} from 'lucide-react';
import QRCode from 'qrcode';
import { Coin, Holding, Transaction } from '../types';
import CameraQrScannerModal from './CameraQrScannerModal';
import AtmOrderRecoveryModal from './AtmOrderRecoveryModal';

interface BitcoinAtmHubProps {
  btcBalance?: number;
  btcAddress?: string;
  coins: Coin[];
  holdings: Holding[];
  transactions?: Transaction[];
  userEmail?: string;
  userName?: string;
  citizenship?: string;
  localcoinPhoneNumber?: string;
  localcoinEmail?: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenSendReceive?: (action: 'send' | 'receive', prefill?: { recipientAddress?: string; amountBtc?: number; symbol?: string; memo?: string }) => void;
}

interface AtmLocation {
  id: string;
  name: string;
  network: 'CoinFlip' | 'Bitcoin Depot' | 'Coinme' | 'Localcoin' | 'Athena' | 'Genesis';
  address: string;
  city: string;
  distance: string;
  type: '2-Way (Buy & Cash-Out)' | '1-Way (Buy Only)';
  hours: string;
  status: 'Online & Cash Loaded' | 'Online (Buy Only)' | 'Maintenance';
  dailyLimit: string;
  currencies: string[];
  latitude: number;
  longitude: number;
}

export default function BitcoinAtmHub({
  btcBalance = 0,
  btcAddress = (import.meta as any).env?.VITE_MARSHALL_BTC_ADDRESS || '',
  coins,
  holdings,
  transactions = [],
  userEmail = '',
  userName = 'Marcel Laframboise',
  citizenship = 'CA',
  localcoinPhoneNumber = '+19057184275',
  localcoinEmail = '',
  showToast,
  onOpenSendReceive
}: BitcoinAtmHubProps) {
  const [activeMode, setActiveMode] = useState<'deposit' | 'cashout' | 'locator'>('deposit');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recoveryTargetTx, setRecoveryTargetTx] = useState<Transaction | undefined>(undefined);
  const [atmLiveReady, setAtmLiveReady] = useState(false);
  const [orderReview, setOrderReview] = useState<{ address: string; amount: number; symbol: string; memo?: string } | null>(null);

  const handleAtmScanSuccess = (data: {
    raw: string;
    address: string;
    amount?: number;
    currency?: string;
    memo?: string;
    parsedResult?: any;
  }) => {
    const parsed = data.parsedResult;
    if (parsed && parsed.source === 'LOCALCOIN') {
      showToast(`Recognized Localcoin ${parsed.category}: ${parsed.displaySubtitle}`, 'success');
      if (parsed.fiatAmount) {
        setCashAmountInput(parsed.fiatAmount.toString());
      }
      if (parsed.category === 'ATM_CASHOUT') {
        setActiveMode('cashout');
        if (parsed.voucherPin) {
          showToast(`Loaded Cash-Out PIN: ${parsed.voucherPin}`, 'info');
        }
        if (parsed.address && parsed.amount) {
          setOrderReview({ address: parsed.address, amount: parsed.amount, symbol: parsed.currency || 'BTC', memo: parsed.memo });
          showToast('Localcoin cash-out payment loaded for review. Nothing was sent.', 'info');
        }
        return;
      }
      if (parsed.address && parsed.amount) {
        setOrderReview({ address: parsed.address, amount: parsed.amount, symbol: parsed.currency || 'BTC', memo: parsed.memo });
      }
      return;
    }

    const isBitcoinAddress = /^(bc1|[13])[a-zA-Z0-9]{20,90}$/.test(data.address);
    if (!isBitcoinAddress || !data.amount || !Number.isFinite(data.amount) || data.amount <= 0) {
      showToast('The scanned Localcoin request is missing a valid Bitcoin address or amount.', 'error');
      return;
    }

    setOrderReview({ address: data.address, amount: data.amount, symbol: data.currency || 'BTC', memo: data.memo });
    showToast('Localcoin payment request loaded for review. Nothing was sent.', 'info');
  };

  // Deposit (Cash -> BTC) Calculator
  const [fiatCurrency, setFiatCurrency] = useState<'USD' | 'CAD'>(citizenship === 'CA' ? 'CAD' : 'USD');
  const [cashAmountInput, setCashAmountInput] = useState<string>('200');

  // Cash-out (BTC -> Cash) State
  const [cashoutAmountFiat, setCashoutAmountFiat] = useState<number>(995);
  const [cashoutPhoneNumber, setCashoutPhoneNumber] = useState<string>(localcoinPhoneNumber);
  const [localcoinEmailAddress, setLocalcoinEmailAddress] = useState<string>(localcoinEmail || userEmail);
  const [activeVoucher, setActiveVoucher] = useState<{
    id: string;
    pin: string;
    amountFiat: number;
    amountBtc: number;
    currency: 'USD' | 'CAD';
    expiryMinutes: number;
    status: 'READY_TO_DISPENSE' | 'DISPENSED';
    createdAt: string;
  } | null>(null);

  // Locator Filter
  const [locatorFilter, setLocatorFilter] = useState<'all' | '2way' | 'coinflip' | 'localcoin'>('all');
  const [searchLocation, setSearchLocation] = useState<string>('');

  useEffect(() => {
    let active = true;
    fetch('/api/atm/status', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((status: { ready?: boolean } | null) => {
        if (active) setAtmLiveReady(status?.ready === true);
      })
      .catch(() => {
        if (active) setAtmLiveReady(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCashoutPhoneNumber(localcoinPhoneNumber);
    setLocalcoinEmailAddress(localcoinEmail || userEmail);
  }, [localcoinPhoneNumber, localcoinEmail, userEmail]);

  const btcPrice = useMemo(() => {
    const coin = coins.find((c) => c.symbol === 'BTC');
    return coin?.price || 64250;
  }, [coins]);

  const exchangeMultiplier = fiatCurrency === 'CAD' ? 1.36 : 1.0;
  const effectiveBtcPriceFiat = btcPrice * exchangeMultiplier;

  // Calculate BTC equivalent for deposit
  const calculatedBtcFromCash = useMemo(() => {
    const cash = parseFloat(cashAmountInput) || 0;
    if (cash <= 0 || effectiveBtcPriceFiat <= 0) return 0;
    return cash / effectiveBtcPriceFiat;
  }, [cashAmountInput, effectiveBtcPriceFiat]);

  // Generate BIP-21 ATM QR code
  useEffect(() => {
    const cash = parseFloat(cashAmountInput) || 0;
    const btcAmount = cash > 0 ? (cash / effectiveBtcPriceFiat).toFixed(8) : '';
    const uri = `bitcoin:${btcAddress}${btcAmount ? `?amount=${btcAmount}&message=ATM%20Cash%20Deposit` : ''}`;

    QRCode.toDataURL(uri, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate ATM QR code:', err));
  }, [btcAddress, cashAmountInput, effectiveBtcPriceFiat]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    showToast('Bitcoin address copied to clipboard!', 'success');
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  const openReviewedOrder = () => {
    if (!orderReview) return;
    onOpenSendReceive?.('send', {
      recipientAddress: orderReview.address,
      amountBtc: orderReview.amount,
      symbol: orderReview.symbol,
      memo: orderReview.memo
    });
  };

  const handleGenerateCashoutVoucher = () => {
    showToast(
      atmLiveReady
        ? 'Live ATM provider is configured, but voucher creation must be completed through the verified Localcoin order flow. Scan a Localcoin QR code first.'
        : 'Localcoin ATM provider is not connected. No voucher was created.',
      'info'
    );
  };

  const atmLocations: AtmLocation[] = [];

  const filteredAtms = atmLocations.filter((atm) => {
    if (locatorFilter === '2way' && !atm.type.includes('2-Way')) return false;
    if (locatorFilter === 'coinflip' && atm.network !== 'CoinFlip') return false;
    if (locatorFilter === 'localcoin' && atm.network !== 'Localcoin') return false;
    if (searchLocation) {
      const q = searchLocation.toLowerCase();
      return (
        atm.name.toLowerCase().includes(q) ||
        atm.address.toLowerCase().includes(q) ||
        atm.city.toLowerCase().includes(q) ||
        atm.network.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-amber-500/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-3xl font-black shadow-lg shrink-0">
              🏧
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Bitcoin ATM & Physical Cash Kiosk Hub
                </h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  Live 2-Way Machine Network
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Deposit physical paper cash directly into your Native SegWit vault, or cash out Bitcoin for physical banknotes at thousands of certified 2-Way Bitcoin ATMs across the US & Canada.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400 font-mono">
                <span className="text-amber-400 font-bold">Vault: {btcBalance.toFixed(2)} BTC</span>
                <span>•</span>
                <span className="text-slate-300 truncate max-w-xs">{btcAddress}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setIsRecoveryModalOpen(true)}
              className="px-3.5 py-2.5 bg-orange-600/90 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5 border border-orange-500/50"
              title="Resolve expired Localcoin ATM or e-Transfer orders"
            >
              <LifeBuoy className="w-4 h-4 text-orange-200" />
              <span>Order Expired / Help</span>
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" />
              <span>Scan ATM Screen Camera</span>
            </button>
            <button
              onClick={() => onOpenSendReceive?.('receive')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer transition-all flex items-center gap-1.5"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Full Address Hub</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex p-1 bg-slate-950/80 border border-slate-800 rounded-2xl mt-6 max-w-lg">
          <button
            onClick={() => setActiveMode('deposit')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'deposit'
                ? 'bg-amber-500 text-black shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Buy with Cash (Deposit)</span>
          </button>
          <button
            onClick={() => setActiveMode('cashout')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'cashout'
                ? 'bg-amber-500 text-black shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Sell for Cash (2-Way ATM)</span>
          </button>
          <button
            onClick={() => setActiveMode('locator')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'locator'
                ? 'bg-amber-500 text-black shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>ATM Locator</span>
          </button>
        </div>

        {orderReview && (
          <div className="mt-4 max-w-2xl rounded-2xl border border-amber-400/50 bg-slate-950/90 p-4 text-xs text-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-black uppercase tracking-wider text-amber-300">Localcoin payment request review</p>
                <p className="mt-1 text-slate-400">Nothing has been sent. Review the destination and amount in your wallet before confirming.</p>
              </div>
              <button type="button" onClick={() => setOrderReview(null)} className="text-slate-400 hover:text-white" aria-label="Dismiss payment request">Dismiss</button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div><span className="text-slate-500">Amount</span><div className="font-mono font-bold text-white">{orderReview.amount.toFixed(8)} BTC</div></div>
              <div><span className="text-slate-500">Destination</span><div className="break-all font-mono text-amber-200">{orderReview.address}</div></div>
            </div>
            {orderReview.memo && <p className="mt-2 text-slate-400">Memo: {orderReview.memo}</p>}
            <button type="button" onClick={openReviewedOrder} className="mt-3 rounded-xl bg-amber-500 px-4 py-2 font-black text-black hover:bg-amber-400">Review in wallet send screen</button>
          </div>
        )}
      </div>

      {/* MODE 1: DEPOSIT (BUY BITCOIN WITH PHYSICAL CASH AT ATM) */}
      {activeMode === 'deposit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* QR Code & Scanner Box */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm flex flex-col items-center text-center space-y-4">
            <div className="w-full flex items-center justify-between border-b border-gray-100 pb-3 text-left">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Physical Machine QR Scanner</h3>
                <p className="text-[11px] text-gray-500">Hold this QR up to any Bitcoin ATM camera</p>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                BIP-21 SegWit
              </span>
            </div>

            {/* QR Card */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col items-center justify-center">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Bitcoin ATM Deposit QR"
                  className="w-56 h-56 rounded-xl bg-white p-2 border border-gray-200 shadow-sm"
                />
              ) : (
                <div className="w-56 h-56 rounded-xl bg-gray-200 animate-pulse flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              )}
              <span className="text-[10px] font-mono font-bold text-gray-600 bg-white px-3 py-1 rounded-md border border-gray-200 mt-3 truncate max-w-xs select-all">
                {btcAddress}
              </span>
            </div>

            {/* Actions */}
            <div className="w-full flex gap-2">
              <button
                onClick={() => handleCopy(btcAddress)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedAddress ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                <span>{copiedAddress ? 'Copied Address!' : 'Copy Bitcoin Address'}</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                title="Print ATM Slip"
              >
                <Printer className="w-4 h-4" />
                <span>Print Slip</span>
              </button>
            </div>
          </div>

          {/* Calculator & Instructions */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live Cash Calculator */}
            <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-500" />
                  <span>ATM Cash-to-Bitcoin Calculator</span>
                </h3>
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
                  <button
                    onClick={() => setFiatCurrency('USD')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer transition-all ${
                      fiatCurrency === 'USD' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    onClick={() => setFiatCurrency('CAD')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer transition-all ${
                      fiatCurrency === 'CAD' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                    }`}
                  >
                    CAD (CA$)
                  </button>
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap gap-2">
                {['50', '100', '200', '500', '1000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCashAmountInput(amt)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      cashAmountInput === amt
                        ? 'bg-amber-500 text-black font-black shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {fiatCurrency === 'CAD' ? 'CA$' : '$'}{amt}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Cash Inserted at Machine
                  </span>
                  <div className="flex items-center">
                    <span className="text-xl font-extrabold text-gray-700 mr-1">
                      {fiatCurrency === 'CAD' ? 'CA$' : '$'}
                    </span>
                    <input
                      type="number"
                      value={cashAmountInput}
                      onChange={(e) => setCashAmountInput(e.target.value)}
                      className="w-full bg-transparent text-2xl font-black text-gray-900 border-none outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">
                    Bitcoin Output Credited to Vault
                  </span>
                  <div className="text-2xl font-black text-amber-950 font-mono">
                    {calculatedBtcFromCash.toFixed(6)} BTC
                  </div>
                  <span className="text-[10px] text-amber-700 font-bold block mt-1">
                    At ${effectiveBtcPriceFiat.toLocaleString(undefined, { maximumFractionDigits: 0 })} {fiatCurrency} / BTC
                  </span>
                </div>
              </div>
            </div>

            {/* Step-by-Step ATM Instructions */}
            <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-blue-600" />
                <span>How to Deposit Cash at any Bitcoin ATM (CoinFlip, Localcoin, Bitcoin Depot)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#0052FF] text-white font-bold flex items-center justify-center text-xs">
                    1
                  </div>
                  <h4 className="font-bold text-gray-900">Scan Wallet QR</h4>
                  <p className="text-gray-500 leading-relaxed text-[11px]">
                    Tap "Buy Bitcoin" on the ATM screen, then hold the QR code on your phone up to the scanner.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#0052FF] text-white font-bold flex items-center justify-center text-xs">
                    2
                  </div>
                  <h4 className="font-bold text-gray-900">Insert Cash</h4>
                  <p className="text-gray-500 leading-relaxed text-[11px]">
                    Feed banknotes ($20, $50, $100 bills) into the ATM cash acceptor one by one.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                    3
                  </div>
                  <h4 className="font-bold text-gray-900">Instant Settlement</h4>
                  <p className="text-gray-500 leading-relaxed text-[11px]">
                    Press "Complete" on the machine. Bitcoin is broadcast on-chain directly to your vault.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: CASHOUT (SELL BTC FOR PAPER CASH AT 2-WAY ATMS) */}
      {activeMode === 'cashout' && (
        <div className="space-y-6">
          {/* Active Configured Standby Order RGVTQ6 Banner */}
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 border border-amber-500/50 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
                  🏧
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-black text-white">Active Order: RGVTQ6 (Localcoin Interac e-Transfer)</h4>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded border border-emerald-500/40">
                      Payment Requested
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Localcoin e-Transfer • Contact: {cashoutPhoneNumber || localcoinEmailAddress || 'Not provided'} • $995.00 CAD Payout Target
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
                0.01039642 BTC
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Localcoin account phone</span>
                <span className="font-mono font-bold text-sky-400">{cashoutPhoneNumber || localcoinPhoneNumber}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Localcoin account email</span>
                <span className="font-mono font-bold text-amber-300 break-all">{localcoinEmailAddress}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Order ID</span>
                <span className="font-mono font-bold text-white">RGVTQ6 (Localcoin)</span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Cash Payout</span>
                <span className="font-mono font-bold text-emerald-400">$995.00 CAD</span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Crypto Due</span>
                <span className="font-mono font-bold text-amber-400">0.01039642 BTC</span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Linked Phone</span>
                <span className="font-mono font-bold text-sky-400">{cashoutPhoneNumber || 'Not provided'}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="truncate">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Localcoin Receiving Address</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-300 text-[11px] select-all">
                    bc1q8yyl8yq9np33jfxlhds6tl836rn3trl0762qsd
                  </span>
                  <a
                    href="https://mempool.space/address/bc1q8yyl8yq9np33jfxlhds6tl836rn3trl0762qsd"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono flex items-center gap-0.5"
                  >
                    <span>Mempool</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => setIsRecoveryModalOpen(true)}
                  className="px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 font-bold text-xs rounded-xl border border-orange-500/40 cursor-pointer transition-all flex items-center gap-1"
                  title="If Localcoin says order expired after sending"
                >
                  <LifeBuoy className="w-3.5 h-3.5" />
                  <span>Order Expired?</span>
                </button>
                <a
                  href={`https://localcoinatm.com/e-transfer?orderId=RGVTQ6${cashoutPhoneNumber ? `&phoneNumber=${encodeURIComponent(cashoutPhoneNumber)}` : ''}${localcoinEmailAddress ? `&email=${encodeURIComponent(localcoinEmailAddress)}` : ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer transition-all flex items-center gap-1"
                >
                  <span>View Localcoin Order</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => {
                    if (onOpenSendReceive) {
                      onOpenSendReceive('send');
                    }
                    showToast('Localcoin Order RGVTQ6 loaded in Send modal! Tap Confirm to broadcast 0.01039642 BTC.', 'success');
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Open 1-Click Send (RGVTQ6)</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cashout Config Card */}
          <div className="lg:col-span-6 bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                <span>2-Way ATM Cash-Out Voucher Generator</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Redeem physical cash at any 2-Way Bitcoin ATM kiosk (CoinFlip, Localcoin, Athena).
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
                  Select Cash Payout Amount
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[50, 100, 200, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashoutAmountFiat(amt)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        cashoutAmountFiat === amt
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-gray-50 text-gray-800 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      ${amt} {fiatCurrency}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Mobile Number (For ATM SMS Dispense Code)
                </label>
                <input
                  type="text"
                  value={cashoutPhoneNumber}
                  onChange={(e) => setCashoutPhoneNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-mono focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    BTC To Be Redeemed
                  </span>
                  <span className="text-lg font-black text-emerald-950 font-mono">
                    {(cashoutAmountFiat / effectiveBtcPriceFiat).toFixed(6)} BTC
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Cash at Machine
                  </span>
                  <span className="text-lg font-black text-emerald-950 font-mono">
                    ${cashoutAmountFiat}.00 {fiatCurrency}
                  </span>
                </div>
              </div>

              <button
                onClick={handleGenerateCashoutVoucher}
                disabled={!atmLiveReady}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <Banknote className="w-4 h-4" />
                <span>{atmLiveReady ? 'Generate ATM Cash Redemption Voucher' : 'Localcoin ATM Connection Required'}</span>
              </button>
            </div>
          </div>

          {/* Active Voucher Display */}
          <div className="lg:col-span-6 space-y-4">
            {activeVoucher ? (
              <div className="bg-slate-900 text-white rounded-3xl border border-emerald-500/40 p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                    <h4 className="text-sm font-bold text-white">Active 2-Way ATM Dispense Voucher</h4>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                    {activeVoucher.status === 'READY_TO_DISPENSE' ? 'Ready for Dispensing' : 'Dispensed'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Voucher ID</span>
                    <span className="text-base font-mono font-black text-amber-400">{activeVoucher.id}</span>
                  </div>
                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">ATM 4-Digit PIN</span>
                    <span className="text-base font-mono font-black text-emerald-400">{activeVoucher.pin}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Cash Amount:</span>
                    <span className="font-bold font-mono text-white">${activeVoucher.amountFiat}.00 {activeVoucher.currency}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">BTC Equivalence:</span>
                    <span className="font-bold font-mono text-amber-400">{activeVoucher.amountBtc.toFixed(6)} BTC</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Expires in:</span>
                    <span className="font-bold text-emerald-400 font-mono">{activeVoucher.expiryMinutes} minutes</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-950/60 border border-amber-800 text-amber-300 rounded-xl text-xs font-bold text-center">
                  Cash dispensing status is reported only by the connected ATM provider.
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-10 flex flex-col items-center justify-center text-center space-y-3">
                <Banknote className="w-12 h-12 text-gray-400" />
                <h4 className="text-sm font-bold text-gray-700">No Active Cash-Out Voucher</h4>
                <p className="text-xs text-gray-500 max-w-sm">
                  Select a cash amount and click "Generate ATM Cash Redemption Voucher" to prepare physical banknotes for pickup.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* MODE 3: ATM LOCATOR & MAP LIST */}
      {activeMode === 'locator' && (
        <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#0052FF]" />
                <span>Certified Bitcoin ATM Kiosk Network</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Locate certified 2-Way Cash Dispensers and Instant Deposit Kiosks in your area.
              </p>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setLocatorFilter('all')}
                className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  locatorFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                }`}
              >
                All ATMs
              </button>
              <button
                onClick={() => setLocatorFilter('2way')}
                className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  locatorFilter === '2way' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                }`}
              >
                2-Way Cash Out
              </button>
              <button
                onClick={() => setLocatorFilter('coinflip')}
                className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  locatorFilter === 'coinflip' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                }`}
              >
                CoinFlip
              </button>
              <button
                onClick={() => setLocatorFilter('localcoin')}
                className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  locatorFilter === 'localcoin' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                }`}
              >
                Localcoin
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by city, street, or network name..."
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-xs pl-9 pr-4 py-2 rounded-xl focus:outline-none focus:border-[#0052FF]"
            />
          </div>

          {/* List of ATMs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAtms.map((atm) => (
              <div
                key={atm.id}
                className="bg-gray-50/70 hover:bg-gray-50 border border-gray-200 rounded-2xl p-4 transition-all shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      {atm.network}
                    </span>
                    <h4 className="text-xs font-bold text-gray-900 mt-1">{atm.name}</h4>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {atm.distance}
                  </span>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <p className="font-medium">{atm.address}</p>
                  <p className="text-[11px] text-gray-500">{atm.city}</p>
                </div>

                <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gray-700">{atm.type}</span>
                  <span className="text-emerald-600 font-bold">{atm.hours}</span>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-mono">Limit: {atm.dailyLimit}</span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${atm.name} ${atm.address} ${atm.city}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[#0052FF] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Directions</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Camera WebRTC Scanner Modal */}
      <CameraQrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleAtmScanSuccess}
        title="Scan Physical Bitcoin ATM Screen"
        instruction="Hold your camera up to the QR code displayed on the physical ATM screen to automatically scan and send Bitcoin on-chain."
      />

      {/* ATM / Localcoin Expired Order & Mempool Reconciliation Recovery Modal */}
      <AtmOrderRecoveryModal
        isOpen={isRecoveryModalOpen}
        onClose={() => {
          setIsRecoveryModalOpen(false);
          setRecoveryTargetTx(undefined);
        }}
        showToast={showToast}
        transactions={transactions}
        activeTx={recoveryTargetTx}
        registeredPhoneNumber={cashoutPhoneNumber || localcoinPhoneNumber}
        registeredEmail={localcoinEmailAddress || userEmail || localcoinEmail}
      />
    </div>
  );
}
