import React, { useState } from 'react';
import { Repeat, Calendar, Clock, Play, Pause, Trash2, Plus, ArrowUpRight, TrendingUp, CheckCircle2, DollarSign, Calculator, ShieldCheck } from 'lucide-react';
import { Coin, Holding, RecurringBuyPlan } from '../types';

interface RecurringBuyHubProps {
  coins: Coin[];
  holdings: Holding[];
  usdBalance: number;
  onExecuteTrade: (type: 'BUY' | 'SELL' | 'CONVERT', assetSymbol: string, amount: number, fiatAmount: number) => void;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export default function RecurringBuyHub({
  coins,
  holdings,
  usdBalance,
  onExecuteTrade,
  showToast
}: RecurringBuyHubProps) {
  // Load plans from local storage or defaults
  const [plans, setPlans] = useState<RecurringBuyPlan[]>(() => {
    const saved = localStorage.getItem('cb_recurring_plans');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [
      {
        id: 'plan-1',
        symbol: 'BTC',
        amountUSD: 50,
        frequency: 'weekly',
        paymentMethod: 'USD Cash Balance',
        nextExecutionDate: 'Tomorrow, 9:00 AM',
        totalInvestedUSD: 600,
        totalTokensAcquired: 0.00985,
        status: 'active',
        createdAt: Date.now() - 86400000 * 84
      },
      {
        id: 'plan-2',
        symbol: 'ETH',
        amountUSD: 25,
        frequency: 'daily',
        paymentMethod: 'USD Cash Balance',
        nextExecutionDate: 'Today, 8:00 PM',
        totalInvestedUSD: 350,
        totalTokensAcquired: 0.1042,
        status: 'active',
        createdAt: Date.now() - 86400000 * 14
      }
    ];
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState('SOL');
  const [newAmountUSD, setNewAmountUSD] = useState('25');
  const [newFrequency, setNewFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [newPaymentMethod, setNewPaymentMethod] = useState('USD Cash Balance');

  // DCA Calculator State
  const [calcSymbol, setCalcSymbol] = useState('BTC');
  const [calcAmount, setCalcAmount] = useState('50');
  const [calcDurationYears, setCalcDurationYears] = useState(2);

  // Sync to local storage
  const savePlans = (updated: RecurringBuyPlan[]) => {
    setPlans(updated);
    localStorage.setItem('cb_recurring_plans', JSON.stringify(updated));
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newAmountUSD);
    if (!amount || amount <= 0) {
      showToast('Please enter a valid investment amount', 'error');
      return;
    }

    const newPlan: RecurringBuyPlan = {
      id: `plan-${Date.now()}`,
      symbol: newSymbol,
      amountUSD: amount,
      frequency: newFrequency,
      paymentMethod: newPaymentMethod,
      nextExecutionDate: newFrequency === 'daily' ? 'Tomorrow, 9:00 AM' : 'Next Monday, 9:00 AM',
      totalInvestedUSD: 0,
      totalTokensAcquired: 0,
      status: 'active',
      createdAt: Date.now()
    };

    const updated = [newPlan, ...plans];
    savePlans(updated);
    setIsCreateOpen(false);
    showToast(`Recurring buy scheduled: $${amount} of ${newSymbol} (${newFrequency})`, 'success');
  };

  const handleToggleStatus = (id: string) => {
    const updated = plans.map((p) => {
      if (p.id === id) {
        const nextStatus = p.status === 'active' ? 'paused' : 'active';
        showToast(`Plan for ${p.symbol} is now ${nextStatus}`, 'info');
        return { ...p, status: nextStatus as 'active' | 'paused' };
      }
      return p;
    });
    savePlans(updated);
  };

  const handleDeletePlan = (id: string) => {
    const plan = plans.find((p) => p.id === id);
    const updated = plans.filter((p) => p.id !== id);
    savePlans(updated);
    showToast(`Cancelled recurring plan for ${plan?.symbol}`, 'info');
  };

  // Simulate an immediate execution of a plan
  const handleTriggerImmediateExecution = (plan: RecurringBuyPlan) => {
    const coin = coins.find((c) => c.symbol === plan.symbol);
    if (!coin) return;

    if (usdBalance < plan.amountUSD) {
      showToast(`Insufficient USD balance ($${usdBalance.toFixed(2)}) for $${plan.amountUSD} scheduled buy`, 'error');
      return;
    }

    const tokens = plan.amountUSD / coin.price;
    onExecuteTrade('BUY', plan.symbol, tokens, plan.amountUSD);

    const updated = plans.map((p) => {
      if (p.id === plan.id) {
        return {
          ...p,
          totalInvestedUSD: p.totalInvestedUSD + plan.amountUSD,
          totalTokensAcquired: p.totalTokensAcquired + tokens,
          nextExecutionDate: p.frequency === 'daily' ? 'Tomorrow, 9:00 AM' : 'In 7 days, 9:00 AM'
        };
      }
      return p;
    });
    savePlans(updated);
    showToast(`DCA Executed: Purchased ${tokens.toFixed(6)} ${plan.symbol} for $${plan.amountUSD.toFixed(2)}`, 'success');
  };

  // DCA Calculator Logic
  const calculateDcaProjections = () => {
    const coin = coins.find((c) => c.symbol === calcSymbol) || coins[0];
    const weeklyUSD = parseFloat(calcAmount) || 50;
    const totalWeeks = calcDurationYears * 52;
    const totalInvested = weeklyUSD * totalWeeks;

    // Estimate based on historical asset appreciation metrics
    const annualGrowthRates: Record<string, number> = {
      BTC: 0.42,
      ETH: 0.38,
      SOL: 0.65,
      ADA: 0.25,
      DOT: 0.22,
      DOGE: 0.30
    };
    const rate = annualGrowthRates[coin.symbol] || 0.35;
    const projectedValue = totalInvested * Math.pow(1 + rate, calcDurationYears * 0.7);
    const profit = projectedValue - totalInvested;
    const percentGain = (profit / totalInvested) * 100;

    return {
      totalInvested,
      projectedValue,
      profit,
      percentGain,
      tokensAcquired: projectedValue / coin.price
    };
  };

  const dcaCalc = calculateDcaProjections();

  const totalMonthlyCommitted = plans
    .filter((p) => p.status === 'active')
    .reduce((sum, p) => {
      if (p.frequency === 'daily') return sum + p.amountUSD * 30;
      if (p.frequency === 'weekly') return sum + p.amountUSD * 4.33;
      if (p.frequency === 'biweekly') return sum + p.amountUSD * 2.16;
      return sum + p.amountUSD;
    }, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Overview */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
              <Repeat className="w-3.5 h-3.5" />
              Automated Wealth Building
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Recurring Buys & Dollar-Cost Averaging
            </h1>
            <p className="text-gray-500 text-sm sm:text-base mt-1 max-w-2xl">
              Eliminate market timing stress. Schedule automated daily, weekly, or monthly crypto purchases to smoothly average out your entry prices over time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0052FF] text-white font-medium hover:bg-blue-600 transition-colors shadow-xs cursor-pointer text-sm"
              id="create-recurring-buy-btn"
            >
              <Plus className="w-4 h-4" />
              Set Up Recurring Buy
            </button>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-gray-100">
          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Plans</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {plans.filter((p) => p.status === 'active').length} of {plans.length}
            </div>
            <div className="text-xs text-gray-400 mt-1">Scheduled automated orders</div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Commitment</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              ${totalMonthlyCommitted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-400 mt-1">Estimated monthly investment</div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Accumulated</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              ${plans.reduce((sum, p) => sum + p.totalInvestedUSD, 0).toLocaleString()}
            </div>
            <div className="text-xs text-emerald-600 font-medium mt-1">Disciplined DCA accumulation</div>
          </div>
        </div>
      </div>

      {/* Active Plans List */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Your Scheduled Purchases</h2>
          <span className="text-xs text-gray-500">Orders execute automatically using available USD balance</span>
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
            <Repeat className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No recurring buys scheduled yet</p>
            <p className="text-gray-400 text-xs mt-1">Set up automated daily or weekly purchases to build long-term holdings.</p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 px-4 py-2 rounded-full bg-[#0052FF] text-white text-xs font-medium hover:bg-blue-600 cursor-pointer"
            >
              Create Your First Plan
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {plans.map((plan) => {
              const coin = coins.find((c) => c.symbol === plan.symbol);
              const currentValue = coin ? plan.totalTokensAcquired * coin.price : plan.totalInvestedUSD;
              const gainLoss = currentValue - plan.totalInvestedUSD;
              const gainPercent = plan.totalInvestedUSD > 0 ? (gainLoss / plan.totalInvestedUSD) * 100 : 0;

              return (
                <div
                  key={plan.id}
                  className="py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-gray-50/50 -mx-4 px-4 rounded-xl"
                  id={`recurring-plan-${plan.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-xs"
                      style={{ backgroundColor: coin?.color || '#0052FF' }}
                    >
                      {plan.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-base">{coin?.name || plan.symbol}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {plan.symbol}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            plan.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {plan.status === 'active' ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-gray-400" />
                          ${plan.amountUSD.toFixed(2)} / {plan.frequency}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          Next: {plan.nextExecutionDate}
                        </span>
                        <span className="hidden sm:inline text-gray-400">via {plan.paymentMethod}</span>
                      </div>
                    </div>
                  </div>

                  {/* Performance stats & controls */}
                  <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                    <div className="text-left md:text-right">
                      <div className="text-xs text-gray-400">Total Invested / Value</div>
                      <div className="text-sm font-semibold text-gray-900">
                        ${plan.totalInvestedUSD.toLocaleString()} → ${currentValue.toFixed(2)}
                      </div>
                      {plan.totalInvestedUSD > 0 && (
                        <div
                          className={`text-xs font-medium flex items-center md:justify-end gap-0.5 ${
                            gainLoss >= 0 ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          <TrendingUp className="w-3 h-3" />
                          {gainLoss >= 0 ? '+' : ''}
                          {gainPercent.toFixed(1)}% (${gainLoss.toFixed(2)})
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTriggerImmediateExecution(plan)}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                        title="Execute scheduled purchase cycle now"
                      >
                        Execute Now
                      </button>
                      <button
                        onClick={() => handleToggleStatus(plan.id)}
                        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                        title={plan.status === 'active' ? 'Pause plan' : 'Resume plan'}
                      >
                        {plan.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Cancel recurring plan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive DCA Calculator & Strategy Visualizer */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="flex items-center gap-2.5 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <Calculator className="w-4 h-4" />
          DCA Historical Return Visualizer
        </div>
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
          How much would your investment have grown?
        </h3>
        <p className="text-gray-300 text-sm mt-1 max-w-xl">
          Compare regular automated dollar-cost averaging versus lump-sum volatility.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Controls */}
          <div className="space-y-4 bg-white/5 backdrop-blur-xs p-5 rounded-xl border border-white/10">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Select Asset</label>
              <select
                value={calcSymbol}
                onChange={(e) => setCalcSymbol(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {coins.map((c) => (
                  <option key={c.symbol} value={c.symbol} className="bg-gray-900 text-white">
                    {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Weekly Contribution ($)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Time Horizon</label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setCalcDurationYears(y)}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      calcDurationYears === y
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/15'
                    }`}
                  >
                    {y} {y === 1 ? 'Year' : 'Years'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Visualizer */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-xs p-6 rounded-xl border border-white/10 flex flex-col justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-400">Total Invested</div>
                <div className="text-xl sm:text-2xl font-bold text-white mt-1">
                  ${dcaCalc.totalInvested.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mt-1">${calcAmount}/week over {calcDurationYears}y</div>
              </div>

              <div>
                <div className="text-xs text-gray-400">Projected Portfolio Value</div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1">
                  ${Math.round(dcaCalc.projectedValue).toLocaleString()}
                </div>
                <div className="text-xs text-emerald-400 font-medium mt-1">
                  +{dcaCalc.percentGain.toFixed(1)}% gain
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <div className="text-xs text-gray-400">Tokens Acquired</div>
                <div className="text-xl sm:text-2xl font-bold text-white mt-1">
                  {dcaCalc.tokensAcquired.toFixed(4)} {calcSymbol}
                </div>
                <div className="text-xs text-gray-400 mt-1">Average price cushion</div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                DCA mitigates the risk of buying the top during sudden volatility spikes.
              </div>
              <button
                onClick={() => {
                  setNewSymbol(calcSymbol);
                  setNewAmountUSD(calcAmount);
                  setNewFrequency('weekly');
                  setIsCreateOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors cursor-pointer text-center"
              >
                Apply As Recurring Plan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Recurring Buy Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-blue-50 text-[#0052FF]">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Set Up Recurring Buy</h3>
                  <p className="text-xs text-gray-500">Automate your investments automatically</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Asset to Purchase</label>
                <select
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0052FF]"
                >
                  {coins.map((c) => (
                    <option key={c.symbol} value={c.symbol}>
                      {c.name} ({c.symbol}) — ${c.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={newAmountUSD}
                    onChange={(e) => setNewAmountUSD(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl pl-8 pr-3 py-2.5 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#0052FF]"
                    placeholder="50"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {['10', '25', '50', '100'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewAmountUSD(preset)}
                      className={`text-xs px-2.5 py-1 rounded-md border cursor-pointer font-medium ${
                        newAmountUSD === preset
                          ? 'border-[#0052FF] bg-blue-50 text-[#0052FF]'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Frequency</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'daily', label: 'Daily' },
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'biweekly', label: 'Every 2 Wks' },
                    { id: 'monthly', label: 'Monthly' }
                  ].map((freq) => (
                    <button
                      key={freq.id}
                      type="button"
                      onClick={() => setNewFrequency(freq.id as any)}
                      className={`py-2 text-xs font-semibold rounded-xl border cursor-pointer transition-colors ${
                        newFrequency === freq.id
                          ? 'border-[#0052FF] bg-blue-50 text-[#0052FF]'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Payment Method</label>
                <select
                  value={newPaymentMethod}
                  onChange={(e) => setNewPaymentMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0052FF]"
                >
                  <option value="USD Cash Balance">USD Cash Balance (Available: ${usdBalance.toFixed(2)})</option>
                  <option value="JPMorgan Chase Bank (ACH ****4821)">JPMorgan Chase Bank (ACH ****4821)</option>
                  <option value="Coinbase USD Debit Card">Coinbase USD Debit Card (Instant)</option>
                </select>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Recurring Schedule:</span>
                  <span className="font-semibold text-gray-800">
                    ${newAmountUSD} of {newSymbol} every {newFrequency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Trading Fee:</span>
                  <span className="text-emerald-600 font-semibold">0.00% (Fee-Free for Coinbase One)</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0052FF] text-white font-medium hover:bg-blue-600 text-sm shadow-xs cursor-pointer"
                >
                  Confirm & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
