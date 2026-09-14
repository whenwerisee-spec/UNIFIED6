import React, { useState } from 'react';
import { FileText, Download, TrendingDown, DollarSign, Calculator, ShieldCheck, CheckCircle2, AlertTriangle, ArrowUpRight, HelpCircle } from 'lucide-react';
import { Coin, Holding, Transaction, TaxSummary, TaxHarvestingOpportunity } from '../types';

interface TaxCenterProps {
  coins: Coin[];
  holdings: Holding[];
  transactions: Transaction[];
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export default function TaxCenter({
  coins,
  holdings,
  transactions,
  showToast
}: TaxCenterProps) {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [methodology, setMethodology] = useState<'FIFO' | 'LIFO' | 'HIFO'>('HIFO');

  // Compute tax stats dynamically based on transactions and methodology
  const calculateTaxSummary = (): TaxSummary => {
    // Sells or Converts generate capital gain/loss
    const disposals = transactions.filter((t) => t.type === 'SELL' || t.type === 'CONVERT');
    const earnIncome = transactions.filter((t) => t.type === 'EARN');

    let shortTerm = 0;
    let longTerm = 0;
    let totalDisposals = 0;

    disposals.forEach((t) => {
      totalDisposals += t.fiatAmount;
      // Simulated cost basis depending on methodology
      const multiplier = methodology === 'HIFO' ? 0.92 : methodology === 'LIFO' ? 0.88 : 0.82;
      const costBasis = t.fiatAmount * multiplier;
      const gain = t.fiatAmount - costBasis;

      // Classify as short-term vs long-term based on age
      const isLongTerm = Date.now() - t.timestamp > 86400000 * 365;
      if (isLongTerm) {
        longTerm += gain;
      } else {
        shortTerm += gain;
      }
    });

    const stakingRewardsIncome = earnIncome.reduce((sum, t) => sum + t.fiatAmount, 0);
    const totalNetGains = shortTerm + longTerm;
    // Estimated tax liability (assuming ~25% blended bracket)
    const estimatedTaxLiability = Math.max(0, (shortTerm * 0.28) + (longTerm * 0.15) + (stakingRewardsIncome * 0.24));

    return {
      taxYear: selectedYear,
      shortTermGains: shortTerm,
      longTermGains: longTerm,
      stakingRewardsIncome,
      totalNetGains,
      totalDisposalsUSD: totalDisposals,
      estimatedTaxLiability,
      methodology
    };
  };

  const taxSummary = calculateTaxSummary();

  // Detect Tax-Loss Harvesting Opportunities across current holdings
  const harvestingOpportunities: TaxHarvestingOpportunity[] = holdings
    .map((h) => {
      const coin = coins.find((c) => c.symbol === h.symbol);
      if (!coin) return null;
      const currentVal = h.amount * coin.price;
      const costBasisTotal = h.amount * h.avgBuyPrice;
      const unrealizedLoss = costBasisTotal - currentVal;

      if (unrealizedLoss > 10) {
        return {
          symbol: h.symbol,
          unrealizedLossUSD: unrealizedLoss,
          currentPrice: coin.price,
          costBasis: h.avgBuyPrice,
          holdingAmount: h.amount,
          potentialTaxSavingsUSD: unrealizedLoss * 0.25,
          recommendation: `Harvest up to $${unrealizedLoss.toFixed(2)} in capital losses to offset taxable gains.`
        };
      }
      return null;
    })
    .filter(Boolean) as TaxHarvestingOpportunity[];

  // CSV Generator for IRS Form 8949
  const handleExportCSV = () => {
    const headers = [
      'Description of Property',
      'Date Acquired',
      'Date Sold',
      'Proceeds (Sales Price)',
      'Cost Basis',
      'Adjustment Code',
      'Gain or Loss',
      'Term (Short/Long)'
    ];

    const rows = transactions
      .filter((t) => t.type === 'SELL' || t.type === 'CONVERT')
      .map((t) => {
        const costBasis = (t.fiatAmount * 0.88).toFixed(2);
        const gain = (t.fiatAmount - parseFloat(costBasis)).toFixed(2);
        const dateSold = new Date(t.timestamp).toISOString().split('T')[0];
        const dateAcquired = new Date(t.timestamp - 86400000 * 45).toISOString().split('T')[0];

        return [
          `"${t.amount} ${t.assetSymbol}"`,
          dateAcquired,
          dateSold,
          t.fiatAmount.toFixed(2),
          costBasis,
          '""',
          gain,
          'Short-Term'
        ].join(',');
      });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Coinbase_IRS_Form_8949_${selectedYear}_${methodology}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported IRS Form 8949 CSV for Tax Year ${selectedYear}`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-3">
              <FileText className="w-3.5 h-3.5" />
              IRS & FinCEN Compliant Reporting
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Crypto Tax Center & IRS Form 8949
            </h1>
            <p className="text-gray-500 text-sm sm:text-base mt-1 max-w-2xl">
              Automate capital gains and losses calculations across spot trades, token conversions, and staking income. Export IRS-ready 8949 and 1099-DA reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl">
              {[2026, 2025, 2024].map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    selectedYear === year ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0052FF] text-white font-medium hover:bg-blue-600 transition-colors shadow-xs cursor-pointer text-sm"
              id="download-tax-report-btn"
            >
              <Download className="w-4 h-4" />
              Download Form 8949 (CSV)
            </button>
          </div>
        </div>

        {/* Methodology Toggle */}
        <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Cost-Basis Accounting:</span>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50/60 p-0.5">
              {(['HIFO', 'FIFO', 'LIFO'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMethodology(m);
                    showToast(`Updated accounting method to ${m}`, 'info');
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    methodology === m
                      ? 'bg-white text-[#0052FF] shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {m} {m === 'HIFO' && '(Tax-Minimizing)'}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-400">
            HIFO (Highest In, First Out) minimizes capital gains by matching highest cost basis first.
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Net Capital Gains</div>
            <div
              className={`text-2xl font-bold mt-1 ${
                taxSummary.totalNetGains >= 0 ? 'text-gray-900' : 'text-emerald-600'
              }`}
            >
              ${taxSummary.totalNetGains.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400 mt-1">Short + Long term combined</div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Short-Term Gains</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              ${taxSummary.shortTermGains.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400 mt-1">Taxed as ordinary income</div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Staking & Rewards</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">
              ${taxSummary.stakingRewardsIncome.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400 mt-1">Reportable miscellaneous income</div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Est. Tax Liability</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              ${taxSummary.estimatedTaxLiability.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400 mt-1">At ~25% federal blended rate</div>
          </div>
        </div>
      </div>

      {/* Tax-Loss Harvesting Scanner */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <TrendingDown className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Tax-Loss Harvesting Opportunities</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Realize current unrealized capital losses to offset taxable capital gains dollar-for-dollar under IRS wash-sale rules.
        </p>

        {harvestingOpportunities.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 text-emerald-800 text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            No significant unrealized losses detected in your current holdings. Your portfolio is in a strong net-gain position!
          </div>
        ) : (
          <div className="space-y-3">
            {harvestingOpportunities.map((opp) => (
              <div
                key={opp.symbol}
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">{opp.symbol}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold">
                      -${opp.unrealizedLossUSD.toFixed(2)} Unrealized Loss
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Holding {opp.holdingAmount.toFixed(4)} {opp.symbol} • Cost Basis: ${opp.costBasis.toFixed(2)} • Current: ${opp.currentPrice.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Est. Tax Savings</div>
                    <div className="text-sm font-bold text-emerald-600">
                      ~${opp.potentialTaxSavingsUSD.toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      showToast(`Tax loss harvesting recommendation recorded for ${opp.symbol}`, 'info');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    View Rebalance Strategy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Taxable Disposals Breakdown Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Reportable Disposals & Discharges ({selectedYear})</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400 uppercase bg-gray-50/50 border-y border-gray-100">
              <tr>
                <th className="py-3 px-4 font-semibold">Asset / Event</th>
                <th className="py-3 px-4 font-semibold">Date Disposed</th>
                <th className="py-3 px-4 font-semibold">Gross Proceeds</th>
                <th className="py-3 px-4 font-semibold">Cost Basis ({methodology})</th>
                <th className="py-3 px-4 font-semibold">Net Gain / Loss</th>
                <th className="py-3 px-4 font-semibold text-right">Holding Term</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions
                .filter((t) => t.type === 'SELL' || t.type === 'CONVERT' || t.type === 'EARN')
                .slice(0, 10)
                .map((t) => {
                  const costBasis = t.type === 'EARN' ? 0 : t.fiatAmount * (methodology === 'HIFO' ? 0.92 : 0.85);
                  const gain = t.fiatAmount - costBasis;

                  return (
                    <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-gray-900 flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            t.type === 'SELL'
                              ? 'bg-blue-500'
                              : t.type === 'CONVERT'
                              ? 'bg-purple-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        {t.amount.toFixed(4)} {t.assetSymbol} ({t.type})
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500">
                        {new Date(t.timestamp).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-gray-900">
                        ${t.fiatAmount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-600">
                        ${costBasis.toFixed(2)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-xs font-bold ${
                          gain >= 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {gain >= 0 ? '+' : ''}${gain.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-right text-gray-500">
                        Short-Term (&lt;1 yr)
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
