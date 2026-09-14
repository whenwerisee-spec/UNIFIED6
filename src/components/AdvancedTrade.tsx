import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  Activity, Clock, ShieldCheck, ChevronDown, CheckCircle2, AlertCircle, RefreshCw, BarChart2
} from 'lucide-react';
import { OrderBook, TradeTapeItem, Candlestick, AdvancedOrder, Coin, Holding } from '../types';

interface AdvancedTradeProps {
  coins: Coin[];
  holdings: Holding[];
  usdBalance: number;
  onExecuteTrade: (
    type: 'BUY' | 'SELL',
    params: {
      symbol: string;
      amount: number;
      fiatAmount: number;
    }
  ) => void;
  showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function AdvancedTrade({
  coins,
  holdings,
  usdBalance,
  onExecuteTrade,
  showToast
}: AdvancedTradeProps) {
  const [selectedPair, setSelectedPair] = useState('BTC-USD');
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP_LIMIT'>('LIMIT');
  const [limitPrice, setLimitPrice] = useState('64230.50');
  const [orderSize, setOrderSize] = useState('0.05');
  const [sliderPercent, setSliderPercent] = useState(25);
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '1d'>('1h');

  // Live order book & tape states
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [trades, setTrades] = useState<TradeTapeItem[]>([]);
  const [candles, setCandles] = useState<Candlestick[]>([]);
  const [activeOrders, setActiveOrders] = useState<AdvancedOrder[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const baseSymbol = selectedPair.split('-')[0];
  const activeCoin = coins.find((c) => c.symbol === baseSymbol) || coins[0];
  const activeHolding = holdings.find((h) => h.symbol === baseSymbol);

  // Fetch Order Book, Trades, and Candles from backend API
  const fetchMarketData = async () => {
    try {
      const [bookRes, tradeRes, candleRes, orderRes] = await Promise.all([
        fetch(`/api/v1/orderbook/${selectedPair}`),
        fetch(`/api/v1/trades/${selectedPair}`),
        fetch(`/api/v1/candles/${selectedPair}?timeframe=${timeframe}`),
        fetch(`/api/v1/orders?symbol=${selectedPair}`)
      ]);

      if (bookRes.ok) {
        const d = await bookRes.json();
        setOrderBook(d.data);
      }
      if (tradeRes.ok) {
        const d = await tradeRes.json();
        setTrades(d.data);
      }
      if (candleRes.ok) {
        const d = await candleRes.json();
        setCandles(d.data);
      }
      if (orderRes.ok) {
        const d = await orderRes.json();
        setActiveOrders(d.data);
      }
    } catch {
      // Offline fallback: generate mock Level 2 book
      const p = activeCoin.price;
      setOrderBook({
        symbol: selectedPair,
        bids: Array.from({ length: 8 }, (_, i) => ({
          price: parseFloat((p - (i + 1) * (p * 0.0006)).toFixed(2)),
          size: parseFloat((0.2 + (i * 0.15)).toFixed(4)),
          total: parseFloat((0.2 + i * 0.4).toFixed(4))
        })),
        asks: Array.from({ length: 8 }, (_, i) => ({
          price: parseFloat((p + (i + 1) * (p * 0.0006)).toFixed(2)),
          size: parseFloat((0.2 + (i * 0.15)).toFixed(4)),
          total: parseFloat((0.2 + i * 0.4).toFixed(4))
        })),
        spread: parseFloat((p * 0.0012).toFixed(2)),
        spreadPercent: 0.12,
        lastUpdated: Date.now()
      });
    }
  };

  useEffect(() => {
    setLimitPrice(activeCoin.price.toFixed(2));
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 3000);
    return () => clearInterval(interval);
  }, [selectedPair, activeCoin.price]);

  const handleSliderChange = (pct: number) => {
    setSliderPercent(pct);
    const p = parseFloat(limitPrice) || activeCoin.price;
    if (orderSide === 'BUY') {
      const maxSpend = usdBalance * (pct / 100);
      const computedSize = maxSpend / p;
      setOrderSize(computedSize > 0.00001 ? computedSize.toFixed(5) : '0');
    } else {
      const coinBal = activeHolding ? activeHolding.amount : 0;
      const computedSize = coinBal * (pct / 100);
      setOrderSize(computedSize > 0.00001 ? computedSize.toFixed(5) : '0');
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = orderType === 'MARKET' ? activeCoin.price : parseFloat(limitPrice);
    const sz = parseFloat(orderSize);

    if (isNaN(p) || p <= 0 || isNaN(sz) || sz <= 0) {
      showToast('Please enter a valid price and size.', 'error');
      return;
    }

    const fiatTotal = p * sz;

    if (orderSide === 'BUY' && fiatTotal > usdBalance) {
      showToast('Insufficient USD cash balance to place this order.', 'error');
      return;
    }

    if (orderSide === 'SELL' && (!activeHolding || activeHolding.amount < sz)) {
      showToast(`Insufficient ${baseSymbol} balance. You have ${(activeHolding?.amount || 0).toFixed(5)} ${baseSymbol}`, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call backend API
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedPair,
          side: orderSide,
          type: orderType,
          price: p,
          size: sz
        })
      });

      if (res.ok) {
        const json = await res.json();
        setActiveOrders((prev) => [json.data, ...prev]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }

    // Execute through root balance state
    onExecuteTrade(orderSide, {
      symbol: baseSymbol,
      amount: sz,
      fiatAmount: fiatTotal
    });

    showToast(`Submitted ${orderType} ${orderSide} order for ${sz} ${baseSymbol} @ $${p.toFixed(2)}`, 'success');
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await fetch(`/api/v1/orders/${orderId}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
    setActiveOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'CANCELLED' } : o)));
    showToast(`Order ${orderId.slice(0, 10)} cancelled`, 'info');
  };

  return (
    <div className="space-y-4">
      {/* Top Ticker Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-black tracking-tight">{selectedPair}</span>
            <div className="flex flex-wrap bg-slate-800 rounded-lg p-0.5 text-xs font-semibold gap-0.5">
              {['BTC-USD', 'ETH-USD', 'OP-USD', 'ARB-USD', 'USDF-USD', 'XAUT-USD', 'SOL-USD', 'POL-USD'].map((pair) => (
                <button
                  key={pair}
                  onClick={() => setSelectedPair(pair)}
                  className={`px-2 py-1 rounded-md cursor-pointer transition-colors text-2xs sm:text-xs ${
                    selectedPair === pair ? 'bg-[#0052FF] text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {pair.split('-')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <div>
            <span className="text-xs text-slate-400 block">Spot Price</span>
            <span className="text-xl font-black font-mono tracking-tight">
              ${activeCoin.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="hidden md:block">
            <span className="text-xs text-slate-400 block">24h Change</span>
            <span className={`text-sm font-bold font-mono flex items-center ${activeCoin.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {activeCoin.change24h >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
              {activeCoin.change24h >= 0 ? '+' : ''}{activeCoin.change24h.toFixed(2)}%
            </span>
          </div>

          <div className="hidden lg:block">
            <span className="text-xs text-slate-400 block">24h High / Low</span>
            <span className="text-xs font-mono text-slate-300">
              ${(activeCoin.price * 1.03).toFixed(2)} / ${(activeCoin.price * 0.97).toFixed(2)}
            </span>
          </div>

          <div className="hidden xl:block">
            <span className="text-xs text-slate-400 block">24h Volume ({baseSymbol})</span>
            <span className="text-xs font-mono text-slate-300">
              {(activeCoin.volume24h / activeCoin.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-semibold">
          <span className="flex items-center text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
            Matching Engine Live (sub-1ms)
          </span>
        </div>
      </div>

      {/* Main Grid: Chart + Orderbook + Order Ticket */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Interactive Candlestick / Area Chart (lg:col-span-6) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-[#0052FF]" />
                <h3 className="text-sm font-bold tracking-tight">Kraken & Coinbase Advanced Chart</h3>
              </div>
              <div className="flex bg-slate-800 rounded-lg p-0.5 text-xs font-mono">
                {(['1m', '5m', '15m', '1h', '1d'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      timeframe === tf ? 'bg-[#0052FF] text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Candlesticks Canvas */}
            <div className="h-72 w-full flex items-end justify-between gap-1 pt-6 pb-2 px-2 bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none opacity-10">
                <div className="w-full border-b border-white" />
                <div className="w-full border-b border-white" />
                <div className="w-full border-b border-white" />
                <div className="w-full border-b border-white" />
              </div>

              {candles.map((candle, idx) => {
                const isGreen = candle.close >= candle.open;
                const heightPercent = Math.min(95, Math.max(10, ((candle.high - candle.low) / (candle.open * 0.03)) * 40));
                const bodyPercent = Math.max(15, (Math.abs(candle.close - candle.open) / (candle.high - candle.low || 1)) * 100);

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 z-20 bg-slate-800 text-[10px] font-mono px-2 py-1 rounded shadow-lg border border-slate-700 hidden group-hover:block whitespace-nowrap pointer-events-none">
                      O: {candle.open.toFixed(1)} H: {candle.high.toFixed(1)} L: {candle.low.toFixed(1)} C: {candle.close.toFixed(1)}
                    </div>
                    {/* Upper & Lower Wick */}
                    <div className={`w-[1px] ${isGreen ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ height: `${heightPercent}%` }}>
                      {/* Body */}
                      <div
                        className={`w-2 -ml-[3.5px] rounded-[1px] ${isGreen ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ height: `${bodyPercent}%`, marginTop: '20%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Depth Chart Indicator */}
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="text-emerald-400 font-semibold">Total Bids: $1.84M (58%)</span>
              <span className="text-red-400 font-semibold">Total Asks: $1.33M (42%)</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex mt-1.5">
              <div className="bg-emerald-500 h-full w-[58%]" />
              <div className="bg-red-500 h-full w-[42%]" />
            </div>
          </div>

          {/* Active Orders Table */}
          <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Your Open & Recent Orders</span>
              </h4>
              <span className="text-[10px] bg-slate-100 font-bold px-2 py-0.5 rounded text-gray-500">
                {activeOrders.length} Orders
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100 text-[10px] uppercase">
                    <th className="py-2">Pair</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Side</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2 text-center">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeOrders.length > 0 ? (
                    activeOrders.slice(0, 5).map((ord) => (
                      <tr key={ord.id} className="hover:bg-gray-50/60">
                        <td className="py-2 font-bold text-gray-900">{ord.symbol}</td>
                        <td className="py-2 text-gray-600">{ord.type}</td>
                        <td className={`py-2 font-bold ${ord.side === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                          {ord.side}
                        </td>
                        <td className="py-2 text-right">${ord.price.toFixed(2)}</td>
                        <td className="py-2 text-right">{ord.size.toFixed(4)}</td>
                        <td className="py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ord.status === 'FILLED' ? 'bg-green-100 text-green-700' : ord.status === 'CANCELLED' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          {ord.status === 'OPEN' && (
                            <button
                              onClick={() => handleCancelOrder(ord.id)}
                              className="text-red-600 hover:underline cursor-pointer font-sans text-[11px] font-bold"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-400 font-sans">
                        No active open orders for {selectedPair}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Center: Live Level 2 Order Book & Trade Tape (lg:col-span-3) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 text-white shadow-sm font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">Level-2 Order Book</span>
              <span className="text-[10px] text-slate-500">Spread: ${orderBook?.spread.toFixed(2) || '1.20'}</span>
            </div>

            {/* Asks (Red) */}
            <div className="space-y-1 my-2">
              {orderBook?.asks.slice(0, 6).reverse().map((ask, i) => (
                <div key={i} className="flex justify-between items-center text-[11px] relative overflow-hidden py-0.5">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-red-500/15 pointer-events-none"
                    style={{ width: `${Math.min(100, (ask.size / 2) * 100)}%` }}
                  />
                  <span className="text-red-400 font-semibold z-10">${ask.price.toFixed(2)}</span>
                  <span className="text-slate-300 z-10">{ask.size.toFixed(4)}</span>
                  <span className="text-slate-500 z-10 hidden sm:inline">{ask.total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Spread Divider */}
            <div className="py-2 my-1 border-y border-slate-800 flex items-center justify-between text-xs bg-slate-950 px-2 rounded-lg">
              <span className="font-bold text-white">${activeCoin.price.toFixed(2)}</span>
              <span className="text-[10px] text-emerald-400 font-bold">USD Mid</span>
            </div>

            {/* Bids (Green) */}
            <div className="space-y-1 my-2">
              {orderBook?.bids.slice(0, 6).map((bid, i) => (
                <div key={i} className="flex justify-between items-center text-[11px] relative overflow-hidden py-0.5">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none"
                    style={{ width: `${Math.min(100, (bid.size / 2) * 100)}%` }}
                  />
                  <span className="text-emerald-400 font-semibold z-10">${bid.price.toFixed(2)}</span>
                  <span className="text-slate-300 z-10">{bid.size.toFixed(4)}</span>
                  <span className="text-slate-500 z-10 hidden sm:inline">{bid.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Trades Tape */}
          <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-xs font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 font-sans">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Trades Tape</span>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
            </div>

            <div className="space-y-1.5 mt-2 max-h-48 overflow-y-auto">
              {trades.slice(0, 8).map((tr) => (
                <div key={tr.id} className="flex items-center justify-between text-[11px]">
                  <span className={tr.side === 'BUY' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                    ${tr.price.toFixed(2)}
                  </span>
                  <span className="text-gray-700">{tr.size.toFixed(4)}</span>
                  <span className="text-gray-400 font-sans text-[10px]">
                    {new Date(tr.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Order Ticket (lg:col-span-3) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-sm space-y-4">
            {/* Buy / Sell Tabs */}
            <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setOrderSide('BUY');
                  handleSliderChange(sliderPercent);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  orderSide === 'BUY' ? 'bg-green-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Buy {baseSymbol}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderSide('SELL');
                  handleSliderChange(sliderPercent);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  orderSide === 'SELL' ? 'bg-red-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sell {baseSymbol}
              </button>
            </div>

            {/* Order Type Selector */}
            <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-0.5 text-xs font-semibold">
              {(['LIMIT', 'MARKET', 'STOP_LIMIT'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={`flex-1 py-1 text-center rounded-md cursor-pointer transition-colors ${
                    orderType === type ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {type === 'STOP_LIMIT' ? 'Stop' : type}
                </button>
              ))}
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-3.5">
              {/* Limit Price Input */}
              {orderType !== 'MARKET' && (
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Limit Price (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 font-mono text-sm">$</span>
                    <input
                      type="number"
                      step="any"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 pl-7 pr-3 py-2 rounded-xl text-sm font-mono font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                    />
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  <span>Amount ({baseSymbol})</span>
                  <span>
                    Avail: {orderSide === 'BUY' ? `$${usdBalance.toFixed(2)}` : `${(activeHolding?.amount || 0).toFixed(4)} ${baseSymbol}`}
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={orderSize}
                  onChange={(e) => setOrderSize(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-sm font-mono font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                />
              </div>

              {/* Quick Allocation Percent Slider */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Allocation</span>
                  <span className="font-mono font-bold text-gray-700">{sliderPercent}%</span>
                </div>
                <div className="flex justify-between gap-1">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleSliderChange(pct)}
                      className={`flex-1 py-1 rounded-md text-[11px] font-bold border cursor-pointer transition-colors ${
                        sliderPercent === pct
                          ? 'bg-[#0052FF]/10 text-[#0052FF] border-[#0052FF]/40'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary & Fees */}
              <div className="bg-gray-50 border border-gray-150 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>Est. Order Total:</span>
                  <span className="font-mono font-bold text-gray-900">
                    ${((parseFloat(orderSize) || 0) * (orderType === 'MARKET' ? activeCoin.price : parseFloat(limitPrice) || 0)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500 text-[11px]">
                  <span>Taker Fee (0.4%):</span>
                  <span className="font-mono">
                    ${(((parseFloat(orderSize) || 0) * activeCoin.price) * 0.004).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500 text-[11px]">
                  <span>Routing:</span>
                  <span className="text-gray-800 font-semibold">Coinbase Smart Router</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 rounded-xl text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition-all shadow-md ${
                  orderSide === 'BUY'
                    ? 'bg-green-600 hover:bg-green-700 active:scale-98'
                    : 'bg-red-600 hover:bg-red-700 active:scale-98'
                }`}
              >
                {isSubmitting ? 'Routing...' : `${orderSide} ${baseSymbol} NOW`}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
