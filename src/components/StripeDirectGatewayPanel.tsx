import React, { useState } from 'react';
import { 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Copy,
  Check,
  Building2,
  DollarSign,
  Landmark,
  FileText
} from 'lucide-react';
import { useStripeDirectGateway, StripePayoutReceipt } from '../hooks/useStripeDirectGateway';

const DEFAULT_USD_CAD_RATE = 1.42;

export const StripeDirectGatewayPanel: React.FC = () => {
  const {
    balance,
    ledgerEntries,
    isLoading,
    isProcessing,
    error,
    lastReceipt,
    fetchBalance,
    syncFiatLedger,
    executePayout,
    createPaymentIntent,
    clearError
  } = useStripeDirectGateway();

  const [depositAmount, setDepositAmount] = useState<string>('250.00');
  const [payoutAmountCad, setPayoutAmountCad] = useState<string>('500.00');
  const [bankDestination, setBankDestination] = useState<string>('TD Canada Trust (Chequing ***8821)');
  const [copiedReceipt, setCopiedReceipt] = useState<boolean>(false);
  const [activeReceiptModal, setActiveReceiptModal] = useState<StripePayoutReceipt | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleTriggerDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMessage(null);
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return;

    try {
      await createPaymentIntent(amt);
      setSuccessMessage(`Payment intent created for $${amt.toFixed(2)} USD via Stripe Direct Gateway.`);
      await fetchBalance(true);
    } catch {
      // Error handled by hook
    }
  };

  const handleTriggerPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMessage(null);
    const amtCad = parseFloat(payoutAmountCad);
    if (isNaN(amtCad) || amtCad <= 0) return;
    const amtUsd = amtCad / DEFAULT_USD_CAD_RATE;

    try {
      const receipt = await executePayout({
        amountCad: amtCad,
        amountUsd: amtUsd,
        bankName: bankDestination,
        accountMask: 'Acct ***8821',
        accountHolder: 'Marcel Laframboise',
        clearingMethod: 'Stripe ACH Express (Same-Day Clearing)'
      });
      setActiveReceiptModal(receipt);
      setSuccessMessage(`Interbank payout of CA$${amtCad.toFixed(2)} dispatched to ${bankDestination}.`);
    } catch {
      // Error handled by hook
    }
  };

  const handleCopyReceipt = (r: StripePayoutReceipt) => {
    const text = `STRIPE DIRECT GATEWAY - FIAT CLEARING RECEIPT
Reference ID: ${r.payoutId}
Amount: CA$${r.amountCad.toFixed(2)} CAD (US$${r.amountUsd.toFixed(2)} USD)
Destination: ${r.bankName} (${r.accountMask})
Beneficiary: ${r.beneficiary}
Clearing Method: ${r.clearingMethod}
Audit Hash: ${r.auditHash}
Timestamp: ${r.timestamp}
Status: ${r.status}`;

    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Balance Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 text-white shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-[#635BFF]/15 border border-[#635BFF]/30 rounded-xl text-[#635BFF]">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Stripe Direct Gateway</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Direct Clearing Active
                </span>
              </div>
              <p className="text-xs text-slate-400">Automated interbank fiat clearing ledgers, real-time balances & instant bank payouts</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => syncFiatLedger()}
              disabled={isLoading || isProcessing}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
              title="Force Sync Clearing Ledgers"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Sync Ledgers</span>
            </button>
          </div>
        </div>

        {/* Live Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Available Direct Balance</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              ${balance.availableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-400 ml-1.5">USD</span>
            </div>
            <div className="text-[11px] text-emerald-400 font-mono font-medium">
              ≈ CA${(balance.availableUsd * DEFAULT_USD_CAD_RATE).toLocaleString(undefined, { minimumFractionDigits: 2 })} CAD
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>In-Flight Clearing (Pending)</span>
              <Landmark className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-slate-200 font-mono">
              ${balance.pendingUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-400 ml-1.5">USD</span>
            </div>
            <div className="text-[11px] text-slate-400">
              ACH Express & Wire clearing buffer
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Instant Payout Capacity</span>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-indigo-300 font-mono">
              ${balance.instantAvailableUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-400 ml-1.5">USD</span>
            </div>
            <div className="text-[11px] text-indigo-400/80 font-medium">
              Instant Interbank RTP & Express ACH
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Action Grid: Inbound Fiat Top-up & Outbound Express Payout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Inbound Top-Up Form */}
          <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              <span>Inbound Card & Bank Clearing</span>
            </div>
            <p className="text-xs text-slate-400">
              Create instant Stripe PaymentIntents to clear fiat directly into your treasury ledger.
            </p>
            <form onSubmit={handleTriggerDeposit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Deposit Amount (USD)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="250.00"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-mono">USD</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={isProcessing || !depositAmount}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                {isProcessing ? <span>Initiating Gateway Handshake...</span> : <span>Initiate Stripe Direct Deposit</span>}
              </button>
            </form>
          </div>

          {/* Outbound Express Payout Form */}
          <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <ArrowUpRight className="w-4 h-4 text-[#635BFF]" />
              <span>Instant Bank Clearing Payout</span>
            </div>
            <p className="text-xs text-slate-400">
              Directly dispatch fiat balances to your linked TD Canada Trust bank account with instant settlement.
            </p>
            <form onSubmit={handleTriggerPayout} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Payout Amount (CAD)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={payoutAmountCad}
                      onChange={(e) => setPayoutAmountCad(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#635BFF]"
                      placeholder="500.00"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">CAD</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Destination Bank</label>
                  <select
                    value={bankDestination}
                    onChange={(e) => setBankDestination(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#635BFF]"
                  >
                    <option value="TD Canada Trust (Chequing ***8821)">TD Canada Trust (***8821)</option>
                    <option value="RBC Royal Bank (CAD Wire ***4410)">RBC Royal Bank (***4410)</option>
                    <option value="Wise CAD Balance (Interac ***9921)">Wise Balance (CAD)</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={isProcessing || !payoutAmountCad || parseFloat(payoutAmountCad) <= 0}
                className="w-full py-2.5 bg-[#635BFF] hover:bg-[#5349e0] disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-[#635BFF]/25 cursor-pointer"
              >
                {isProcessing ? <span>Dispatching Interbank Clearing...</span> : <span>Execute Direct Bank Payout</span>}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Automated Fiat Clearing Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 text-white shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center space-x-2.5">
            <FileText className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-bold text-white">Automated Fiat Clearing Ledgers</h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {ledgerEntries.length} Recorded Entries
          </span>
        </div>

        {ledgerEntries.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
            <Building2 className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No recent clearing entries recorded. Any Stripe deposits or bank payouts will appear here in real-time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                  <th className="pb-2.5 font-medium">Reference ID</th>
                  <th className="pb-2.5 font-medium">Type / Method</th>
                  <th className="pb-2.5 font-medium">Amount (CAD / USD)</th>
                  <th className="pb-2.5 font-medium">Destination</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium text-right">Audit Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 text-indigo-300 font-bold">{entry.payoutId || entry.id}</td>
                    <td className="py-3 font-sans text-slate-300">
                      <span className="capitalize font-bold text-white">{entry.type}</span> • {entry.clearingMethod}
                    </td>
                    <td className="py-3">
                      <div className="font-bold text-white">CA${entry.amountCad?.toFixed(2) || (entry.amountUsd * DEFAULT_USD_CAD_RATE).toFixed(2)} CAD</div>
                      <div className="text-[10px] text-slate-400">US${entry.amountUsd.toFixed(2)} USD</div>
                    </td>
                    <td className="py-3 font-sans text-slate-300">{entry.bankName || 'TD Canada Trust'}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-[10px] uppercase font-bold">
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-[10px] text-slate-400 truncate max-w-[120px]">
                      {entry.auditHash.slice(0, 10)}...{entry.auditHash.slice(-6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout Interbank Receipt Modal */}
      {activeReceiptModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Official Interbank Payout Receipt</h4>
                  <p className="text-[11px] text-slate-400">Stripe Direct Gateway Fiat Clearing Record</p>
                </div>
              </div>
              <button
                onClick={() => setActiveReceiptModal(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400 font-sans">Payout ID:</span>
                <span className="text-indigo-400 font-bold">{activeReceiptModal.payoutId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Amount Dispatched:</span>
                <span className="text-white font-bold">CA${activeReceiptModal.amountCad.toFixed(2)} CAD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">USD Valuation:</span>
                <span className="text-slate-300">US${activeReceiptModal.amountUsd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Destination:</span>
                <span className="text-white font-bold">{activeReceiptModal.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Beneficiary:</span>
                <span className="text-slate-300">{activeReceiptModal.beneficiary}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Clearing Method:</span>
                <span className="text-emerald-400 font-bold">{activeReceiptModal.clearingMethod}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 font-sans block">Cryptographic Audit Hash:</span>
                <span className="text-[10px] text-indigo-300 break-all">{activeReceiptModal.auditHash}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleCopyReceipt(activeReceiptModal)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 border border-slate-700 cursor-pointer"
              >
                {copiedReceipt ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedReceipt ? 'Receipt Copied!' : 'Copy Receipt'}</span>
              </button>
              <button
                onClick={() => setActiveReceiptModal(null)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center cursor-pointer"
              >
                Close & Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
