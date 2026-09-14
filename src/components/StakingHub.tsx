import React, { useState, useEffect } from 'react';
import { Coins, Sparkles, TrendingUp, ShieldCheck, Clock, ArrowDownToLine, ArrowUpRight, HelpCircle, Lock, Unlock, CheckCircle } from 'lucide-react';
import { Coin, Holding, StakingAssetInfo, StakingPosition } from '../types';

interface StakingHubProps {
  coins: Coin[];
  holdings: Holding[];
  onExecuteTrade: (type: 'BUY' | 'SELL' | 'CONVERT' | 'EARN', assetSymbol: string, amount: number, fiatAmount: number) => void;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

const SUPPORTED_STAKING_ASSETS: StakingAssetInfo[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum 2.0 (cbETH)',
    apyPercent: 3.85,
    lockupPeriodDays: 3,
    payoutFrequency: 'Every 3 days',
    validatorName: 'Coinbase Institutional Cloud Validator',
    minStake: 0.01,
    network: 'Ethereum Consensus Layer'
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    apyPercent: 6.85,
    lockupPeriodDays: 2,
    payoutFrequency: 'Every Epoch (~2 days)',
    validatorName: 'Coinbase High-Speed Edge Validator',
    minStake: 0.1,
    network: 'Solana Proof of History'
  },
  {
    symbol: 'ADA',
    name: 'Cardano',
    apyPercent: 4.40,
    lockupPeriodDays: 5,
    payoutFrequency: 'Every 5 days',
    validatorName: 'Coinbase Stake Pool (CB-1)',
    minStake: 10,
    network: 'Cardano Ouroboros'
  },
  {
    symbol: 'DOT',
    name: 'Polkadot',
    apyPercent: 11.20,
    lockupPeriodDays: 28,
    payoutFrequency: 'Daily',
    validatorName: 'Coinbase Nominated Node',
    minStake: 1,
    network: 'Polkadot Relay Chain'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin Rewards',
    apyPercent: 5.10,
    lockupPeriodDays: 0,
    payoutFrequency: 'Monthly auto-deposit',
    validatorName: 'Coinbase Consortium Backed Reserve',
    minStake: 1,
    network: 'Native Compound Treasury'
  }
];

export default function StakingHub({
  coins,
  holdings,
  onExecuteTrade,
  showToast
}: StakingHubProps) {
  // Load staked positions or initialize defaults
  const [positions, setPositions] = useState<StakingPosition[]>(() => {
    const saved = localStorage.getItem('cb_staked_positions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [
      {
        symbol: 'ETH',
        amountStaked: 0.85,
        accruedRewardsUSD: 14.82,
        apyPercent: 3.85,
        startDate: Date.now() - 86400000 * 45,
        status: 'active'
      },
      {
        symbol: 'SOL',
        amountStaked: 14.2,
        accruedRewardsUSD: 28.45,
        apyPercent: 6.85,
        startDate: Date.now() - 86400000 * 60,
        status: 'active'
      }
    ];
  });

  const [activeModal, setActiveModal] = useState<'stake' | 'unstake' | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<StakingAssetInfo>(SUPPORTED_STAKING_ASSETS[0]);
  const [inputAmount, setInputAmount] = useState('');

  // Persist positions
  const savePositions = (updated: StakingPosition[]) => {
    setPositions(updated);
    localStorage.setItem('cb_staked_positions', JSON.stringify(updated));
  };

  // Real-time ticking rewards counter
  useEffect(() => {
    const interval = setInterval(() => {
      setPositions((prev) =>
        prev.map((pos) => {
          if (pos.status !== 'active') return pos;
          const coin = coins.find((c) => c.symbol === pos.symbol);
          const price = coin?.price || 1;
          const stakedUSD = pos.amountStaked * price;
          // Micro accrued reward every 2 seconds
          const perSecondYield = (stakedUSD * (pos.apyPercent / 100)) / (365 * 86400);
          return {
            ...pos,
            accruedRewardsUSD: pos.accruedRewardsUSD + perSecondYield * 2
          };
        })
      );
    }, 2000);
    return () => clearInterval(interval);
  }, [coins]);

  // Aggregate totals
  const totalStakedUSD = positions.reduce((sum, pos) => {
    const coin = coins.find((c) => c.symbol === pos.symbol);
    return sum + pos.amountStaked * (coin?.price || 1);
  }, 0);

  const totalAccruedUSD = positions.reduce((sum, pos) => sum + pos.accruedRewardsUSD, 0);

  const estimatedAnnualYieldUSD = positions.reduce((sum, pos) => {
    const coin = coins.find((c) => c.symbol === pos.symbol);
    const usdVal = pos.amountStaked * (coin?.price || 1);
    return sum + usdVal * (pos.apyPercent / 100);
  }, 0);

  const handleOpenStake = (asset: StakingAssetInfo) => {
    setSelectedAsset(asset);
    setInputAmount('');
    setActiveModal('stake');
  };

  const handleOpenUnstake = (asset: StakingAssetInfo) => {
    setSelectedAsset(asset);
    setInputAmount('');
    setActiveModal('unstake');
  };

  const handleConfirmStake = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(inputAmount);
    const userHolding = holdings.find((h) => h.symbol === selectedAsset.symbol)?.amount || 0;

    if (!amount || amount <= 0) {
      showToast('Please specify a valid stake amount', 'error');
      return;
    }

    if (amount > userHolding) {
      showToast(`Insufficient ${selectedAsset.symbol} balance (${userHolding.toFixed(4)} available)`, 'error');
      return;
    }

    const coin = coins.find((c) => c.symbol === selectedAsset.symbol);
    const fiatValue = amount * (coin?.price || 1);

    // Deduct from regular holding
    onExecuteTrade('CONVERT', selectedAsset.symbol, amount, fiatValue);

    // Add to staked position
    const existingIndex = positions.findIndex((p) => p.symbol === selectedAsset.symbol);
    let updated: StakingPosition[];
    if (existingIndex >= 0) {
      updated = [...positions];
      updated[existingIndex] = {
        ...updated[existingIndex],
        amountStaked: updated[existingIndex].amountStaked + amount
      };
    } else {
      updated = [
        ...positions,
        {
          symbol: selectedAsset.symbol,
          amountStaked: amount,
          accruedRewardsUSD: 0,
          apyPercent: selectedAsset.apyPercent,
          startDate: Date.now(),
          status: 'active'
        }
      ];
    }

    savePositions(updated);
    setActiveModal(null);
    showToast(`Successfully staked ${amount} ${selectedAsset.symbol} at ${selectedAsset.apyPercent}% APY!`, 'success');
  };

  const handleConfirmUnstake = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(inputAmount);
    const pos = positions.find((p) => p.symbol === selectedAsset.symbol);

    if (!pos || !amount || amount <= 0 || amount > pos.amountStaked) {
      showToast('Invalid unstaking amount requested', 'error');
      return;
    }

    const coin = coins.find((c) => c.symbol === selectedAsset.symbol);
    const fiatValue = amount * (coin?.price || 1);

    // Return to regular holdings
    onExecuteTrade('EARN', selectedAsset.symbol, amount, fiatValue);

    const updated = positions
      .map((p) => {
        if (p.symbol === selectedAsset.symbol) {
          const remaining = p.amountStaked - amount;
          return remaining > 0.0001 ? { ...p, amountStaked: remaining } : null;
        }
        return p;
      })
      .filter(Boolean) as StakingPosition[];

    savePositions(updated);
    setActiveModal(null);
    showToast(`Unstaked ${amount} ${selectedAsset.symbol} back to available portfolio balance`, 'success');
  };

  const handleClaimAllRewards = () => {
    if (totalAccruedUSD <= 0.01) {
      showToast('No accrued rewards available to claim yet', 'info');
      return;
    }

    // Convert total accrued USD into portfolio USD
    onExecuteTrade('EARN', 'USDC', totalAccruedUSD, totalAccruedUSD);

    const updated = positions.map((p) => ({ ...p, accruedRewardsUSD: 0 }));
    savePositions(updated);
    showToast(`Claimed $${totalAccruedUSD.toFixed(2)} in rewards directly to your USD balance!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Protocol Yield Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Staking & Passive Yield Rewards
            </h1>
            <p className="text-gray-500 text-sm sm:text-base mt-1 max-w-2xl">
              Put your digital assets to work securing decentralized networks. Earn up to 11.2% APY with automatic compounding and institutional custodial protection.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClaimAllRewards}
              disabled={totalAccruedUSD < 0.01}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-colors shadow-xs cursor-pointer text-sm ${
                totalAccruedUSD >= 0.01
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              id="claim-staking-rewards-btn"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Claim All Rewards (${totalAccruedUSD.toFixed(2)})
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-gray-100">
          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value Staked</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              ${totalStakedUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-400 mt-1">{positions.length} active positions</div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Accrued Rewards (Live)</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
              <span>${totalAccruedUSD.toFixed(4)}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-xs text-emerald-600 font-medium mt-1">Compounding in real time</div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Projected Annual Yield</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              +${estimatedAnnualYieldUSD.toFixed(2)}/yr
            </div>
            <div className="text-xs text-gray-400 mt-1">
              ~${(estimatedAnnualYieldUSD / 12).toFixed(2)}/month passive cash flow
            </div>
          </div>
        </div>
      </div>

      {/* Active Positions */}
      {positions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Your Active Staked Assets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {positions.map((pos) => {
              const coin = coins.find((c) => c.symbol === pos.symbol);
              const assetInfo = SUPPORTED_STAKING_ASSETS.find((a) => a.symbol === pos.symbol);
              const fiatValue = pos.amountStaked * (coin?.price || 1);

              return (
                <div
                  key={pos.symbol}
                  className="p-5 rounded-xl border border-gray-200 bg-white hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between"
                  id={`staked-card-${pos.symbol}`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
                          style={{ backgroundColor: coin?.color || '#0052FF' }}
                        >
                          {pos.symbol}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 flex items-center gap-2">
                            {coin?.name || pos.symbol}
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                              {pos.apyPercent}% APY
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{assetInfo?.network}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-gray-400">Accrued Rewards</div>
                        <div className="text-sm font-bold text-emerald-600">
                          +${pos.accruedRewardsUSD.toFixed(4)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">Staked Principal:</span>
                        <div className="font-semibold text-gray-900 mt-0.5">
                          {pos.amountStaked.toFixed(4)} {pos.symbol} (${fiatValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400">Payout Schedule:</span>
                        <div className="font-medium text-gray-700 mt-0.5">
                          {assetInfo?.payoutFrequency || 'Daily'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                    {assetInfo && (
                      <>
                        <button
                          onClick={() => handleOpenUnstake(assetInfo)}
                          className="px-3.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          Unstake
                        </button>
                        <button
                          onClick={() => handleOpenStake(assetInfo)}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-50 text-[#0052FF] text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          Stake More
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Eligible Staking Assets Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Supported Staking Opportunities</h2>
            <p className="text-xs text-gray-500">Transparent APYs vetted by Coinbase Blockchain Infrastructure</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400 uppercase bg-gray-50/50 border-y border-gray-100">
              <tr>
                <th className="py-3 px-4 font-semibold">Asset</th>
                <th className="py-3 px-4 font-semibold">Annual APY</th>
                <th className="py-3 px-4 font-semibold">Payout Schedule</th>
                <th className="py-3 px-4 font-semibold">Lockup / Unbonding</th>
                <th className="py-3 px-4 font-semibold">Your Available</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SUPPORTED_STAKING_ASSETS.map((asset) => {
                const coin = coins.find((c) => c.symbol === asset.symbol);
                const holding = holdings.find((h) => h.symbol === asset.symbol)?.amount || 0;
                const holdingUSD = holding * (coin?.price || 1);

                return (
                  <tr key={asset.symbol} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs"
                          style={{ backgroundColor: coin?.color || '#0052FF' }}
                        >
                          {asset.symbol}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{asset.name}</div>
                          <div className="text-xs text-gray-400">{asset.validatorName}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 font-bold text-emerald-600 text-base">
                      {asset.apyPercent.toFixed(2)}%
                    </td>

                    <td className="py-4 px-4 text-gray-600 text-xs">
                      {asset.payoutFrequency}
                    </td>

                    <td className="py-4 px-4 text-xs text-gray-600">
                      {asset.lockupPeriodDays === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> No lockup
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          <Lock className="w-3.5 h-3.5 text-gray-400" /> {asset.lockupPeriodDays} days
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-xs">
                      <div className="font-semibold text-gray-900">
                        {holding.toFixed(4)} {asset.symbol}
                      </div>
                      <div className="text-gray-400">${holdingUSD.toFixed(2)}</div>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleOpenStake(asset)}
                        className="px-4 py-1.5 rounded-full bg-[#0052FF] text-white text-xs font-semibold hover:bg-blue-600 transition-colors cursor-pointer shadow-2xs"
                      >
                        Stake {asset.symbol}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stake / Unstake Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-blue-50 text-[#0052FF]">
                  {activeModal === 'stake' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg capitalize">
                    {activeModal} {selectedAsset.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {activeModal === 'stake'
                      ? `Earn ${selectedAsset.apyPercent}% APY protocol yield`
                      : 'Withdraw back to available spot portfolio'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={activeModal === 'stake' ? handleConfirmStake : handleConfirmUnstake}
              className="space-y-4 mt-4"
            >
              <div>
                <div className="flex justify-between items-center mb-1.5 text-xs">
                  <span className="font-semibold text-gray-700">Amount to {activeModal}</span>
                  <span className="text-gray-500">
                    Available:{' '}
                    {activeModal === 'stake'
                      ? (holdings.find((h) => h.symbol === selectedAsset.symbol)?.amount || 0).toFixed(4)
                      : (positions.find((p) => p.symbol === selectedAsset.symbol)?.amountStaked || 0).toFixed(4)}{' '}
                    {selectedAsset.symbol}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={inputAmount}
                    onChange={(e) => setInputAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#0052FF]"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const max =
                        activeModal === 'stake'
                          ? holdings.find((h) => h.symbol === selectedAsset.symbol)?.amount || 0
                          : positions.find((p) => p.symbol === selectedAsset.symbol)?.amountStaked || 0;
                      setInputAmount(max.toString());
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0052FF] hover:underline cursor-pointer"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Yield estimate banner if staking */}
              {activeModal === 'stake' && (
                <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-800 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>Protocol APY:</span>
                    <span>{selectedAsset.apyPercent}%</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Est. Annual Return:</span>
                    <span>
                      {((parseFloat(inputAmount) || 0) * (selectedAsset.apyPercent / 100)).toFixed(4)}{' '}
                      {selectedAsset.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Unbonding Period:</span>
                    <span>{selectedAsset.lockupPeriodDays} days</span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0052FF] text-white font-medium hover:bg-blue-600 text-sm shadow-xs cursor-pointer capitalize"
                >
                  Confirm {activeModal}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
