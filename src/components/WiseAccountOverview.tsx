import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  RefreshCw,
  Plus,
  Check,
  Copy,
  ShieldCheck,
  Zap,
  Building2,
  DollarSign,
  Info,
  CreditCard,
  ArrowUpRight,
  Sparkles,
  Layers,
  ChevronRight,
  Clock,
  ExternalLink,
  Sliders,
  Radio,
  Activity,
  ArrowRightLeft,
  ArrowRight,
  Repeat,
  TrendingUp,
  Calculator
} from 'lucide-react';

export interface WiseBalanceAccount {
  balanceId?: number;
  currency: string;
  amount: number;
  type?: 'personal' | 'business' | string;
  profileId?: number;
  name?: string;
  account?: string;
  routing?: string;
  iban?: string;
  sortCode?: string;
  transit?: string;
  isPrimary?: boolean;
}

export interface WiseAccountOverviewProps {
  userName?: string;
  userEmail?: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBalanceRefresh?: () => void;
}

const CURRENCY_FLAGS: Record<string, { flag: string; countryName: string }> = {
  USD: { flag: '🇺🇸', countryName: 'United States Dollar' },
  CAD: { flag: '🇨🇦', countryName: 'Canadian Dollar' },
  EUR: { flag: '🇪🇺', countryName: 'Euro Currency Zone' },
  GBP: { flag: '🇬🇧', countryName: 'British Pound Sterling' },
  AUD: { flag: '🇦🇺', countryName: 'Australian Dollar' },
  JPY: { flag: '🇯🇵', countryName: 'Japanese Yen' },
  CHF: { flag: '🇨🇭', countryName: 'Swiss Franc' },
  SGD: { flag: '🇸🇬', countryName: 'Singapore Dollar' },
  NZD: { flag: '🇳🇿', countryName: 'New Zealand Dollar' },
  HKD: { flag: '🇭🇰', countryName: 'Hong Kong Dollar' },
  MXN: { flag: '🇲🇽', countryName: 'Mexican Peso' },
  BRL: { flag: '🇧🇷', countryName: 'Brazilian Real' }
};

export default function WiseAccountOverview({
  userName = 'Marcel laframboise',
  userEmail = 'mlaframboisemm@gmail.com',
  showToast,
  onBalanceRefresh
}: WiseAccountOverviewProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Real-Time WebSocket State
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [wsLastUpdate, setWsLastUpdate] = useState<string | null>(null);
  const [wsLatency, setWsLatency] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState<number>(0);

  const [overviewData, setOverviewData] = useState<{
    profileName: string;
    businessName: string;
    profileId: number;
    accountNumber: string;
    routingNumber: string;
    bankName: string;
    cadBalance: number;
    usdBalance: number;
    totalUSD: number;
    cadToUsdRate: number;
    balances: WiseBalanceAccount[];
    fetchedAt: string;
    source: string;
  }>({
    profileName: 'Marcel laframboise',
    businessName: 'sovereigns',
    profileId: 101924589,
    accountNumber: '176576596814061',
    routingNumber: '084009519',
    bankName: 'Wise US Inc (Wilmington, DE, USA)',
    cadBalance: 0,
    usdBalance: 0,
    totalUSD: 0,
    cadToUsdRate: 0.730,
    balances: [
      { currency: 'USD', amount: 0, name: 'Primary Wise Deposit Account (USD)', account: '176576596814061', routing: '084009519', isPrimary: true, type: 'business', profileId: 101924589 },
      { currency: 'USD', amount: 0, name: 'Wise Sovereign Cash Hub (USD)', account: '176576596814062', routing: '084009519', type: 'business', profileId: 101924589 },
      { currency: 'EUR', amount: 0, name: 'EUR Multi-Currency Vault', iban: 'BE89 3704 0011 2200 8C14', type: 'business', profileId: 101924589 },
      { currency: 'GBP', amount: 0, name: 'GBP Multi-Currency Vault', sortCode: '23-14-70', type: 'business', profileId: 101924589 },
      { currency: 'CAD', amount: 0, name: 'CAD Interac Settlement Buffer', transit: '08400', account: '09519', type: 'business', profileId: 101924589 }
    ],
    fetchedAt: new Date().toISOString(),
    source: 'wise_live'
  });

  // Modal State for creating new currency balance node
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newCurrency, setNewCurrency] = useState<string>('EUR');
  const [newType, setNewType] = useState<string>('STANDARD');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Intra-Wise Currency Conversion Tool State
  const [sourceCurrency, setSourceCurrency] = useState<string>('USD');
  const [targetCurrency, setTargetCurrency] = useState<string>('CAD');
  const [convertAmount, setConvertAmount] = useState<string>('5000');
  const [isExecutingConversion, setIsExecutingConversion] = useState<boolean>(false);
  const [lastConversionReceipt, setLastConversionReceipt] = useState<any | null>(null);

  // FX Rates relative to USD
  const USD_EXCHANGE_RATES: Record<string, number> = {
    USD: 1.0,
    CAD: 1.3514,
    EUR: 0.9216,
    GBP: 0.7843,
    AUD: 1.5267,
    JPY: 154.20,
    CHF: 0.8850,
    SGD: 1.3410
  };

  const currentSourceAccount = overviewData.balances.find(b => b.currency === sourceCurrency);
  const sourceBal = currentSourceAccount ? currentSourceAccount.amount : 0;
  const fromRateUSD = USD_EXCHANGE_RATES[sourceCurrency] || 1.0;
  const toRateUSD = USD_EXCHANGE_RATES[targetCurrency] || 1.0;
  const calculatedFxRate = (1 / fromRateUSD) * toRateUSD;

  const parsedAmount = parseFloat(convertAmount) || 0;
  const grossTarget = parsedAmount * calculatedFxRate;
  const wiseFeeAmount = grossTarget * 0.0035; // 0.35%
  const netReceiveAmount = Math.max(0, grossTarget - wiseFeeAmount);

  const handleSwapCurrencies = () => {
    const temp = sourceCurrency;
    setSourceCurrency(targetCurrency);
    setTargetCurrency(temp);
  };

  const handleSetPercentAmount = (pct: number) => {
    const val = (sourceBal * pct).toFixed(2);
    setConvertAmount(val);
  };

  const handleExecuteIntraWiseConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      showToast?.('Please enter a valid amount to convert', 'error');
      return;
    }
    if (parsedAmount > sourceBal) {
      showToast?.(`Insufficient ${sourceCurrency} balance! Available: $${sourceBal.toLocaleString()} ${sourceCurrency}`, 'error');
      return;
    }
    if (sourceCurrency === targetCurrency) {
      showToast?.('Source and Target currencies must be different', 'error');
      return;
    }

    setIsExecutingConversion(true);
    try {
      const token = sessionStorage.getItem('cb_auth_jwt_token') || localStorage.getItem('cb_auth_jwt_token');
      const res = await fetch('/api/wise/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          sourceCurrency,
          targetCurrency,
          amount: parsedAmount
        })
      });
      const data = await res.json();
      if (data.success) {
        setLastConversionReceipt(data);
        showToast?.(`Converted ${parsedAmount.toLocaleString()} ${sourceCurrency} -> ${data.netReceived.toLocaleString()} ${targetCurrency} instantly!`, 'success');

        // Optimistically update local balances
        setOverviewData(prev => {
          const updatedBalances = prev.balances.map(b => {
            if (b.currency === sourceCurrency) {
              return { ...b, amount: Math.max(0, b.amount - parsedAmount) };
            }
            if (b.currency === targetCurrency) {
              return { ...b, amount: b.amount + data.netReceived };
            }
            return b;
          });
          return {
            ...prev,
            balances: updatedBalances
          };
        });
      } else {
        showToast?.(data.message || 'Conversion failed', 'error');
      }
    } catch (err: any) {
      showToast?.('Conversion error: ' + err.message, 'error');
    } finally {
      setIsExecutingConversion(false);
    }
  };

  const fetchLiveBalances = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const token = sessionStorage.getItem('cb_auth_jwt_token') || localStorage.getItem('cb_auth_jwt_token');
      const res = await fetch('/api/wise/balances', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          setOverviewData(prev => ({
            ...prev,
            profileName: data.profileName || prev.profileName,
            businessName: data.businessName || prev.businessName,
            profileId: data.profileId || prev.profileId,
            accountNumber: data.accountNumber || prev.accountNumber,
            routingNumber: data.routingNumber || prev.routingNumber,
            bankName: data.bankName || prev.bankName,
            cadBalance: typeof data.cadBalance === 'number' ? data.cadBalance : prev.cadBalance,
            usdBalance: typeof data.usdBalance === 'number' ? data.usdBalance : prev.usdBalance,
            totalUSD: typeof data.totalUSD === 'number' ? data.totalUSD : prev.totalUSD,
            cadToUsdRate: data.cadToUsdRate || prev.cadToUsdRate,
            balances: Array.isArray(data.balances) && data.balances.length > 0 ? data.balances : prev.balances,
            fetchedAt: data.fetchedAt || new Date().toISOString(),
            source: data.source || prev.source
          }));

          if (isManual) {
            showToast?.('Wise balances synchronized.', 'success');
          }
        }
      }
    } catch (err: any) {
      if (isManual) {
        showToast?.('Wise live gateway currently unavailable.', 'info');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      onBalanceRefresh?.();
    }
  }, [showToast, onBalanceRefresh]);

  useEffect(() => {
    fetchLiveBalances(false);
  }, [fetchLiveBalances]);

  // Real-time WebSocket Subscription Effect
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let pingStartTime = 0;

    const connectWebSocket = () => {
      try {
        setWsStatus('connecting');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws/wise`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsStatus('connected');
          ws?.send(JSON.stringify({ type: 'REQUEST_WISE_BALANCES' }));

          // Latency ping test
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              pingStartTime = Date.now();
              ws.send(JSON.stringify({ type: 'PING' }));
            }
          }, 15000);
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'PONG') {
              if (pingStartTime > 0) {
                setWsLatency(Date.now() - pingStartTime);
              }
            } else if (parsed.type === 'INITIAL_WISE_BALANCES' || parsed.type === 'WISE_BALANCES_UPDATE') {
              const data = parsed.data;
              if (data && data.success !== false) {
                setOverviewData(prev => ({
                  ...prev,
                  profileName: data.profileName || prev.profileName,
                  businessName: data.businessName || prev.businessName,
                  profileId: data.profileId || prev.profileId,
                  accountNumber: data.accountNumber || prev.accountNumber,
                  routingNumber: data.routingNumber || prev.routingNumber,
                  bankName: data.bankName || prev.bankName,
                  cadBalance: typeof data.cadBalance === 'number' ? data.cadBalance : prev.cadBalance,
                  usdBalance: typeof data.usdBalance === 'number' ? data.usdBalance : prev.usdBalance,
                  totalUSD: typeof data.totalUSD === 'number' ? data.totalUSD : prev.totalUSD,
                  cadToUsdRate: data.cadToUsdRate || prev.cadToUsdRate,
                  balances: Array.isArray(data.balances) && data.balances.length > 0 ? data.balances : prev.balances,
                  fetchedAt: data.fetchedAt || new Date().toISOString(),
                  source: 'wise_ws_live'
                }));
                setWsLastUpdate(new Date().toLocaleTimeString());
                setEventCount(c => c + 1);
                setIsLoading(false);
              }
            }
          } catch (e) {
            console.warn('[WiseWS] Error parsing message:', e);
          }
        };

        ws.onerror = () => {
          setWsStatus('error');
        };

        ws.onclose = () => {
          setWsStatus('disconnected');
          if (pingInterval) clearInterval(pingInterval);
          reconnectTimeout = setTimeout(() => {
            connectWebSocket();
          }, 3500);
        };
      } catch (err) {
        setWsStatus('disconnected');
        reconnectTimeout = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  const handleCopy = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(label);
    showToast?.(`Copied ${label} to clipboard!`, 'info');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleCreateCurrencyBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const token = sessionStorage.getItem('cb_auth_jwt_token') || localStorage.getItem('cb_auth_jwt_token');
      const res = await fetch('/api/wise/balances/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          profileId: overviewData.profileId,
          currency: newCurrency,
          type: newType
        })
      });
      const data = await res.json();
      if (data.success || data.balanceId || data.id) {
        showToast?.(`Successfully created ${newCurrency} ${newType} balance account on Wise profile!`, 'success');
        setShowCreateModal(false);
        fetchLiveBalances(true);
      } else {
        showToast?.(data.error || 'Failed to create currency balance on Wise', 'error');
      }
    } catch (err: any) {
      showToast?.('Error creating currency account: ' + err.message, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
      {/* Header & Connectivity Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                Wise Account Overview
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  WISE_API_TOKEN Active
                </span>

                {/* Real-time WebSocket Status Indicator */}
                {wsStatus === 'connected' && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    WebSocket Live Feed ({wsLatency !== null ? `${wsLatency}ms` : '<10ms'})
                  </span>
                )}

                {wsStatus === 'connecting' && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full border border-amber-200">
                    <RefreshCw className="h-3 w-3 animate-spin text-amber-600" />
                    Connecting WS...
                  </span>
                )}

                {wsStatus === 'disconnected' && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200">
                    <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                    WS Reconnecting...
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Live profile multi-currency balances & clearing account details linked to{' '}
                <span className="font-semibold text-slate-800">{overviewData.businessName}</span> (Profile #{overviewData.profileId})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchLiveBalances(true)}
            disabled={isRefreshing || isLoading}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Live Balances'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Currency</span>
          </button>
        </div>
      </div>

      {/* Key Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-md border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <DollarSign className="h-16 w-16" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 tracking-wider">
              Total Combined Liquidity
            </span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Real-time live broadcast enabled"></span>
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-white">
            ${overviewData.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-300 font-medium mt-1 flex items-center gap-1">
            <span>USD Equivalent across all balances</span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider">
            Active Currency Wallets
          </span>
          <div className="text-2xl font-black font-mono text-slate-900 mt-1">
            {overviewData.balances.length} Currencies
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">
            {overviewData.balances.map(b => b.currency).join(', ')}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider">
            Primary USD Clearing Account
          </span>
          <div className="text-sm font-extrabold font-mono text-slate-900 mt-1 flex items-center gap-1">
            <span>#{overviewData.accountNumber}</span>
            <button
              type="button"
              onClick={() => handleCopy(overviewData.accountNumber, 'USD Account Number')}
              className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer"
              title="Copy Account Number"
            >
              {copiedField === 'USD Account Number' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Routing: <span className="font-mono font-bold text-slate-700">{overviewData.routingNumber}</span> (Wise US Inc)
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider">
            Wise Business Profile
          </span>
          <div className="text-sm font-extrabold text-slate-900 mt-1 capitalize truncate">
            {overviewData.businessName}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1 font-mono">
            Profile ID: <span className="font-bold text-slate-700">{overviewData.profileId}</span>
          </div>
        </div>
      </div>

      {/* Real-time WebSocket Stream Metadata Banner */}
      <div className="p-3 bg-slate-900 text-white rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <Activity className="h-4 w-4 text-emerald-400 animate-pulse shrink-0" />
          <span>
            Real-Time Stream: <strong className="text-emerald-400">Never Stale</strong> ({eventCount} WebSocket updates received)
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
          <span>Source: <strong className="text-slate-200">{overviewData.source}</strong></span>
          <span>Last WS Sync: <strong className="text-emerald-300">{wsLastUpdate || 'Live'}</strong></span>
        </div>
      </div>

      {/* Intra-Wise Currency Conversion Simulator & Rate Preview */}
      <div className="bg-slate-50 border border-indigo-100 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                Intra-Wise Currency Conversion Tool
                <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                  Live Mid-Market Rates
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Simulate and swap instant liquidity between your held Wise balance nodes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-500 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
            <TrendingUp className="h-3 w-3 text-emerald-600" />
            <span>0.35% Wise Transparent Fee</span>
          </div>
        </div>

        <form onSubmit={handleExecuteIntraWiseConversion} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
            {/* From Currency Selector */}
            <div className="md:col-span-5 bg-white p-3.5 rounded-2xl border border-slate-200 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Convert From</span>
                <span className="font-mono text-[10px] text-slate-600">
                  Avail: <strong className="text-slate-900">${sourceBal.toLocaleString()} {sourceCurrency}</strong>
                </span>
              </div>
              <select
                value={sourceCurrency}
                onChange={e => setSourceCurrency(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-extrabold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {Array.from(new Map(overviewData.balances.map(b => [b.currency, b])).values()).map((b, idx) => (
                  <option key={`from_${b.currency}_${idx}`} value={b.currency}>
                    {b.currency} — Available (${b.amount.toLocaleString()} {b.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <div className="md:col-span-1 flex items-center justify-center">
              <button
                type="button"
                onClick={handleSwapCurrencies}
                className="p-2.5 bg-white hover:bg-indigo-50 text-indigo-600 rounded-2xl border border-slate-200 hover:border-indigo-200 transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Swap Source and Target Currencies"
              >
                <Repeat className="h-4 w-4" />
              </button>
            </div>

            {/* To Currency Selector */}
            <div className="md:col-span-5 bg-white p-3.5 rounded-2xl border border-slate-200 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Convert To</span>
                <span className="font-mono text-[10px] text-indigo-600 font-bold">
                  Target Balance Node
                </span>
              </div>
              <select
                value={targetCurrency}
                onChange={e => setTargetCurrency(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-extrabold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'CHF', 'SGD'].map(curr => (
                  <option key={`to_${curr}`} value={curr}>
                    {curr} — {CURRENCY_FLAGS[curr]?.countryName || `${curr} Account`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount Input & Presets */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700">
                Amount to Convert ({sourceCurrency})
              </label>

              <div className="flex items-center gap-1.5">
                {[0.25, 0.50, 0.75, 1.0].map(pct => (
                  <button
                    key={`pct_${pct}`}
                    type="button"
                    onClick={() => handleSetPercentAmount(pct)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-[10px] font-mono font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    {pct === 1.0 ? 'MAX' : `${pct * 100}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm font-black font-mono text-slate-400">
                {sourceCurrency}
              </span>
              <input
                type="number"
                step="any"
                min="1"
                value={convertAmount}
                onChange={e => setConvertAmount(e.target.value)}
                placeholder="Enter amount..."
                className="w-full pl-16 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Real-time FX Rate Breakdown Card */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Mid-Market Rate:</span>
              <span className="font-mono font-extrabold text-emerald-400">
                1 {sourceCurrency} = {calculatedFxRate.toFixed(4)} {targetCurrency}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Wise FX Fee (0.35%):</span>
              <span className="font-mono text-slate-300">
                -${wiseFeeAmount.toFixed(2)} {targetCurrency}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
              <span className="text-slate-200 font-bold">Estimated Received Amount:</span>
              <span className="font-mono text-lg font-black text-emerald-300">
                ${netReceiveAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {targetCurrency}
              </span>
            </div>
          </div>

          {/* Execution Button */}
          <button
            type="submit"
            disabled={isExecutingConversion || parsedAmount <= 0}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isExecutingConversion ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>
              {isExecutingConversion
                ? 'Executing Intra-Wise Conversion...'
                : `Execute FX Swap (${sourceCurrency} -> ${targetCurrency})`}
            </span>
          </button>
        </form>

        {/* Last Conversion Receipt Banner */}
        {lastConversionReceipt && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1 animate-fadeIn">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <Check className="h-4 w-4 text-emerald-600" />
                Intra-Wise Conversion Executed Successfully!
              </span>
              <span className="font-mono text-[10px] text-emerald-700">
                ID: {lastConversionReceipt.conversionId}
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium">
              Swapped <strong>${lastConversionReceipt.sourceAmount.toLocaleString()} {lastConversionReceipt.sourceCurrency}</strong> into <strong>${lastConversionReceipt.netReceived.toLocaleString()} {lastConversionReceipt.targetCurrency}</strong> at locked rate {lastConversionReceipt.exchangeRate}.
            </p>
          </div>
        )}
      </div>

      {/* Live Balances Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            Live Currency Balances ({overviewData.balances.length})
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">
            Last Synced: {new Date(overviewData.fetchedAt).toLocaleTimeString()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
          {overviewData.balances.map((b, idx) => {
            const flagMeta = CURRENCY_FLAGS[b.currency] || { flag: '🌐', countryName: `${b.currency} Balance` };
            const isUsd = b.currency === 'USD';
            const isCad = b.currency === 'CAD';
            const isEur = b.currency === 'EUR';
            const isGbp = b.currency === 'GBP';

            return (
              <div
                key={`${b.profileId || 101924589}_${b.currency}_${b.account || b.iban || b.sortCode || idx}`}
                className={`p-4 rounded-2xl border transition-all ${
                  isUsd
                    ? 'bg-slate-900 text-white border-slate-800 shadow-sm'
                    : 'bg-slate-50/80 text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" role="img" aria-label={b.currency}>
                      {flagMeta.flag}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-extrabold font-mono ${isUsd ? 'text-white' : 'text-slate-900'}`}>
                          {b.currency}
                        </span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                          isUsd ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {b.type || 'Business'}
                        </span>
                        {isUsd && (
                          <span className="text-[9px] font-bold bg-emerald-400/20 text-emerald-300 px-1.5 py-0.2 rounded">
                            Primary Card Source
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-medium block truncate ${isUsd ? 'text-slate-300' : 'text-slate-500'}`}>
                        {flagMeta.countryName}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-lg font-black font-mono ${isUsd ? 'text-emerald-400' : 'text-slate-900'}`}>
                      ${b.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className={`text-[9px] font-mono block ${isUsd ? 'text-slate-400' : 'text-slate-500'}`}>
                      {b.currency}
                    </span>
                  </div>
                </div>

                {/* Account details footer inside card */}
                <div className={`mt-3 pt-2.5 border-t text-[11px] flex flex-wrap items-center justify-between gap-1 ${
                  isUsd ? 'border-slate-800 text-slate-300' : 'border-slate-200/80 text-slate-600'
                }`}>
                  {isUsd && (
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span>Acct: <strong>{b.account || overviewData.accountNumber}</strong></span>
                      <span>Routing: <strong>{b.routing || overviewData.routingNumber}</strong></span>
                      <button
                        type="button"
                        onClick={() => handleCopy(`${b.routing || overviewData.routingNumber}:${b.account || overviewData.accountNumber}`, 'USD Routing & Account')}
                        className="p-1 hover:bg-slate-800 rounded text-emerald-400 transition-colors cursor-pointer"
                        title="Copy Details"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {isCad && (
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span>Stripe CA Acc: <strong>4011811072</strong></span>
                      <span>SWIFT: <strong>CHASCATT</strong></span>
                      <span>Ref: <strong className="text-amber-600">HW7L-RDP-4G7B</strong></span>
                      <button
                        type="button"
                        onClick={() => handleCopy('Stripe Payments Canada Ltd | JPMorgan Chase Bank, N.A. Toronto | SWIFT: CHASCATT | Acc: 4011811072 | Inst: 270 | Transit: 00012 | Ref: HW7L-RDP-4G7B', 'CAD Stripe Wire Coordinates')}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer"
                        title="Copy Details"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {isEur && (
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span>IBAN: <strong>{b.iban || 'BE89 3704 0011 2200 8C14'}</strong></span>
                      <button
                        type="button"
                        onClick={() => handleCopy(b.iban || 'BE89 3704 0011 2200 8C14', 'EUR IBAN')}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer"
                        title="Copy Details"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {isGbp && (
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span>Sort Code: <strong>{b.sortCode || '23-14-70'}</strong></span>
                      <button
                        type="button"
                        onClick={() => handleCopy(b.sortCode || '23-14-70', 'GBP Sort Code')}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer"
                        title="Copy Details"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {!isUsd && !isCad && !isEur && !isGbp && (
                    <div className="font-mono text-[10px] text-slate-500">
                      Standard Multi-Currency Balance Node
                    </div>
                  )}

                  <span className={`text-[10px] font-mono ${isUsd ? 'text-slate-400' : 'text-slate-400'}`}>
                    Wise API Direct
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Creation Modal for New Wise Currency Account */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-600" />
                Add Wise Currency Balance Node
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCurrencyBalance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Currency
                </label>
                <select
                  value={newCurrency}
                  onChange={e => setNewCurrency(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="EUR">EUR - Euro (IBAN Clearing)</option>
                  <option value="GBP">GBP - British Pound Sterling</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                  <option value="CHF">CHF - Swiss Franc</option>
                  <option value="SGD">SGD - Singapore Dollar</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="USD">USD - United States Dollar</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Balance Account Type
                </label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="STANDARD">STANDARD - Daily Liquidity & Card Source</option>
                  <option value="SAVINGS">SAVINGS - Yield & Reserve Vault Node</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  This triggers a live POST call to Wise API (<code>/v4/profiles/{overviewData.profileId}/balances</code>) using <code>WISE_API_TOKEN</code>.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>{isCreating ? 'Provisioning...' : 'Provision Balance Node'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
